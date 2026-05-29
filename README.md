# mcp-boe-uk

Bank of England Interactive Statistical Database (IADB) MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 250+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
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

Or connect to the full Pipeworx gateway for access to all 250+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Boe Uk data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [All tools and guides](https://github.com/pipeworx-io/examples)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
