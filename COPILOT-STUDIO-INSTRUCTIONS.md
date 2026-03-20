# Copilot Studio — HoloDex Integration

## Overview

HoloDex is an MCP server that generates PowerPoint presentations. Connect it to Copilot Studio as a tool, and the agent will call it based on the user's request. The MCP tools are self-describing — the agent discovers available slide types, palettes, and schemas automatically.

## MCP Endpoint

```
https://pptx-engine.wonderfulground-b6cde5f0.eastus2.azurecontainerapps.io/mcp
```

Local development: `http://localhost:3000/mcp`

## Agent Instructions

Paste into the Copilot Studio **Instructions** field:

```
You create PowerPoint presentations using the HoloDex MCP tools.

When a user asks for a presentation:
1. Call list_palettes and list_slide_types to discover what's available
2. Build the slide array based on the user's request — vary slide types for visual interest
3. Call create_presentation with returnUrl: true
4. Share the download URL with the user

Always set returnUrl: true. Use paletteName to pick a color theme. Add aiImage: { prompt: "..." } on slides where a generated image would help.

If the user wants the file saved to OneDrive, download the PPTX from the returnUrl and upload it via the OneDrive MCP.
```

## Available MCP Tools

The agent discovers these automatically via the MCP protocol:

| Tool | Purpose |
|------|---------|
| `create_presentation` | Generate PPTX from slide definitions |
| `create_quick_presentation` | Generate from a simple text outline |
| `generate_image` | Generate a standalone AI image |
| `list_slide_types` | Discover available slide types + their schemas |
| `list_palettes` | Discover available color palettes |
| `register_brand` | Register company brand colors/fonts/logo |
| `list_brands` | List registered brands |
| `get_design_tips` | Get design guidance |

## Key Parameters

**Always pass** `returnUrl: true` — this returns a download link instead of raw binary.

**Optional**: `paletteName` (e.g. `"midnight-executive"`, `"coral-energy"`) and `brandName` for registered brands.

**AI images**: Add `aiImage: { prompt: "..." }` to any slide that supports images. The server uses Flux (FLUX.2-pro) by default when deployed to Azure. No configuration needed.

## Agent365 / ToolingManifest.json

```json
{
  "id": "mcp_HoloDex",
  "name": "HoloDex Presentation Engine",
  "transportType": "streamablehttp",
  "url": "https://pptx-engine.wonderfulground-b6cde5f0.eastus2.azurecontainerapps.io/mcp",
  "enabled": true,
  "tags": ["presentations", "powerpoint", "pptx"]
}
```

## Notes

- Download URLs expire after **1 hour**
- AI images are generated server-side using Flux (FLUX.2-pro) — no client-side API keys needed
- Maximum **50 slides** per presentation
- Brand registration is persistent across requests
