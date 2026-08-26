# mcp-boe-uk

Bank of England Interactive Statistical Database (IADB) MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1476+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `get_series` | Fetch one or more Bank of England IADB series by code over a date range. Requires BoE series codes (e.g. IUDBEDR = Bank Rate, IUDSOIA = SONIA, XUDLUSS = USD/GBP, XUDLERS = EUR/GBP). Use list_known_series or the convenience tools (bank_rate, sonia, usd_gbp, eur_gbp) if you do not know the code. Returns parsed JSON: one entry per series with observations [{date, value}]. |
| `bank_rate` | Latest N observations of the Bank of England official Bank Rate (series IUDBEDR), most recent first. |
| `sonia` | Latest N observations of SONIA, the Sterling Overnight Index Average (series IUDSOIA), most recent first. |
| `usd_gbp` | Latest N observations of the USD/GBP spot rate — US$ per £1 (series XUDLUSS), most recent first. |
| `eur_gbp` | Latest N observations of the EUR/GBP spot rate — € per £1 (series XUDLERS), most recent first. |
| `list_known_series` | List the friendly BoE series codes this pack surfaces (Bank Rate, SONIA, USD/GBP, EUR/GBP) with their IADB codes. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "boe-uk": {
      "url": "https://gateway.pipeworx.io/boe-uk/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/boe-uk/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1476+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Boe Uk data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
