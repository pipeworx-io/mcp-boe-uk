interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Bank of England Interactive Statistical Database (IADB) MCP.
 *
 * Keyless. Pulls official UK monetary statistics (Bank Rate, SONIA, GBP FX rates, etc.)
 * from the BoE IADB CSV endpoint and parses the CSV into clean JSON observations.
 *
 * Callers generally need BoE series codes (e.g. IUDBEDR, IUDSOIA, XUDLUSS). If you only
 * want a common indicator, use the convenience tools bank_rate / sonia / usd_gbp / eur_gbp,
 * or list_known_series to discover the friendly codes.
 */


const BASE = 'https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp';
const UA = 'pipeworx-mcp-boe-uk/1.0 (+https://pipeworx.io)';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Well-known BoE IADB series codes surfaced for LLM convenience. */
const KNOWN_SERIES: Record<string, { code: string; description: string }> = {
  bank_rate: { code: 'IUDBEDR', description: 'Official Bank Rate (Bank of England policy rate), daily.' },
  sonia: { code: 'IUDSOIA', description: 'SONIA — Sterling Overnight Index Average, daily.' },
  usd_gbp: { code: 'XUDLUSS', description: 'Spot exchange rate, US$ per £1 (USD/GBP), daily.' },
  eur_gbp: { code: 'XUDLERS', description: 'Spot exchange rate, € per £1 (EUR/GBP), daily.' },
  bank_rate_monthly: { code: 'IUMABEDR', description: 'Official Bank Rate, monthly average (month-end rows).' },
};

const tools: McpToolExport['tools'] = [
  {
    name: 'get_series',
    description:
      'Fetch one or more Bank of England IADB series by code over a date range. Requires BoE series codes ' +
      '(e.g. IUDBEDR = Bank Rate, IUDSOIA = SONIA, XUDLUSS = USD/GBP, XUDLERS = EUR/GBP). ' +
      'Use list_known_series or the convenience tools (bank_rate, sonia, usd_gbp, eur_gbp) if you do not know the code. ' +
      'Returns parsed JSON: one entry per series with observations [{date, value}].',
    inputSchema: {
      type: 'object',
      properties: {
        series_codes: {
          type: 'array',
          items: { type: 'string' },
          description: 'BoE series codes, e.g. ["IUDBEDR","IUDSOIA"]. Also accepts a single comma-separated string.',
        },
        from: { type: 'string', description: 'Start date "DD/Mon/YYYY" (e.g. "01/Jan/2024") or ISO "YYYY-MM-DD".' },
        to: { type: 'string', description: 'End date "DD/Mon/YYYY", ISO "YYYY-MM-DD", or "now" (default "now").' },
      },
      required: ['series_codes', 'from'],
    },
  },
  {
    name: 'bank_rate',
    description: 'Latest N observations of the Bank of England official Bank Rate (series IUDBEDR), most recent first.',
    inputSchema: {
      type: 'object',
      properties: { last: { type: 'number', description: 'Number of most-recent observations (default 10).' } },
    },
  },
  {
    name: 'sonia',
    description: 'Latest N observations of SONIA, the Sterling Overnight Index Average (series IUDSOIA), most recent first.',
    inputSchema: {
      type: 'object',
      properties: { last: { type: 'number', description: 'Number of most-recent observations (default 10).' } },
    },
  },
  {
    name: 'usd_gbp',
    description: 'Latest N observations of the USD/GBP spot rate — US$ per £1 (series XUDLUSS), most recent first.',
    inputSchema: {
      type: 'object',
      properties: { last: { type: 'number', description: 'Number of most-recent observations (default 10).' } },
    },
  },
  {
    name: 'eur_gbp',
    description: 'Latest N observations of the EUR/GBP spot rate — € per £1 (series XUDLERS), most recent first.',
    inputSchema: {
      type: 'object',
      properties: { last: { type: 'number', description: 'Number of most-recent observations (default 10).' } },
    },
  },
  {
    name: 'list_known_series',
    description: 'List the friendly BoE series codes this pack surfaces (Bank Rate, SONIA, USD/GBP, EUR/GBP) with their IADB codes.',
    inputSchema: { type: 'object', properties: {} },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'list_known_series':
      return {
        series: Object.entries(KNOWN_SERIES).map(([friendly, v]) => ({
          friendly,
          code: v.code,
          description: v.description,
        })),
        note: 'Use get_series with any BoE IADB code, or the named convenience tools for these.',
      };

    case 'get_series': {
      const codes = parseCodes(args.series_codes);
      if (codes.length === 0) throw new Error('Required argument "series_codes" is missing. Pass codes like ["IUDBEDR","IUDSOIA"].');
      const from = normalizeDate(reqStr(args, 'from', '"01/Jan/2024"'));
      const to = normalizeDate((args.to as string | undefined) ?? 'now');
      const series = await fetchSeries(codes, from, to);
      return { series };
    }

    case 'bank_rate':
    case 'sonia':
    case 'usd_gbp':
    case 'eur_gbp': {
      const { code } = KNOWN_SERIES[name];
      const last = clampLast(args.last);
      // Wide range so monthly/sparse series still return recent points; trim to N afterward.
      const series = await fetchSeries([code], '01/Jan/2020', 'now');
      const obs = series[0]?.observations ?? [];
      const latest = obs.slice(-last).reverse();
      return { seriesCode: code, indicator: name, observations: latest };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

interface ParsedSeries {
  seriesCode: string;
  observations: Array<{ date: string; value: number }>;
}

async function fetchSeries(codes: string[], from: string, to: string): Promise<ParsedSeries[]> {
  const params = new URLSearchParams({
    'csv.x': 'yes',
    Datefrom: from,
    Dateto: to,
    SeriesCodes: codes.join(','),
    CSVF: 'TN',
    UsingCodes: 'Y',
    VPD: 'Y',
    VFD: 'N',
  });
  // redirect: 'manual' — a bad/unknown series code 302-redirects to an HTML error page;
  // following it would yield a deceptive 200. Treat the redirect as an error instead.
  const res = await fetch(`${BASE}?${params.toString()}`, {
    headers: { Accept: 'text/csv', 'User-Agent': UA },
    redirect: 'manual',
  });
  const body = await res.text();
  if (!res.ok || res.status >= 300) {
    throw new Error(`BoE: ${res.status} ${body.slice(0, 200)}`);
  }
  if (body.trimStart().startsWith('<')) {
    throw new Error(`BoE: ${res.status} unexpected HTML response (check series codes): ${body.slice(0, 200)}`);
  }
  return parseCsv(body, codes);
}

/**
 * IADB CSVF=TN layout (verified):
 *   DATE,CODE1,CODE2,...
 *   01 Jan 2024,5.25,3.72,...
 * First column is the date ("DD Mon YYYY"); each subsequent column is one series.
 * Cells may be empty when a (e.g. monthly) series has no value on a given date row.
 */
function parseCsv(csv: string, requested: string[]): ParsedSeries[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return requested.map((code) => ({ seriesCode: code, observations: [] }));
  }
  const header = splitCsvLine(lines[0]);
  // header[0] is the date label ("DATE"); header[1..] are series codes (in returned order).
  const colCodes = header.slice(1);
  const series: ParsedSeries[] = colCodes.map((code) => ({ seriesCode: code, observations: [] }));

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const isoDate = toIsoDate(cells[0]);
    if (!isoDate) continue;
    for (let c = 0; c < colCodes.length; c++) {
      const raw = (cells[c + 1] ?? '').trim();
      if (raw === '') continue; // sparse cell — series has no value this row
      const value = Number(raw);
      if (Number.isNaN(value)) continue;
      series[c].observations.push({ date: isoDate, value });
    }
  }
  return series;
}

function splitCsvLine(line: string): string[] {
  // IADB CSV values (dates, numbers, codes) contain no embedded commas/quotes; simple split is safe.
  return line.split(',').map((s) => s.trim());
}

/** "01 Jan 2024" -> "2024-01-01". Returns '' if unparseable. */
function toIsoDate(s: string): string {
  const m = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(s.trim());
  if (!m) return '';
  const mi = MONTHS.findIndex((mo) => mo.toLowerCase() === m[2].toLowerCase());
  if (mi < 0) return '';
  return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** Accept BoE "DD/Mon/YYYY", ISO "YYYY-MM-DD", or "now"; output the API's "DD/Mon/YYYY" or "now". */
function normalizeDate(input: string): string {
  const s = input.trim();
  if (s.toLowerCase() === 'now') return 'now';
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) {
    const mi = Number(iso[2]) - 1;
    if (mi < 0 || mi > 11) throw new Error(`Invalid month in date "${s}".`);
    return `${iso[3]}/${MONTHS[mi]}/${iso[1]}`;
  }
  // Already in DD/Mon/YYYY (or close enough) — pass through.
  if (/^\d{1,2}\/[A-Za-z]{3}\/\d{4}$/.test(s)) return s;
  throw new Error(`Invalid date "${s}". Use "DD/Mon/YYYY" (e.g. "01/Jan/2024"), ISO "YYYY-MM-DD", or "now".`);
}

function parseCodes(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

function clampLast(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(Math.floor(n), 500);
}

function reqStr(args: Record<string, unknown>, key: string, example: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Required argument "${key}" is missing. Pass a string like ${example}.`);
  return v;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
