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
1. Call list_palettes and list_slide_types to discover available options and see EXAMPLES
2. Build the slide array — EVERY slide MUST have full content, not just a title:
   - content slides: include a "body" field with 2-3 detailed sentences
   - bullet-list slides: include "items" array with 4-6 items like [{"text": "point"}]
   - two-column slides: include "leftContent" and "rightContent" with paragraphs
   - three-column slides: include "columns" array with 3 items [{title, content}]
   - image-text slides: include "body" text AND "aiImage": {"prompt": "description"}
   - full-image slides: include "aiImage": {"prompt": "description of image"}
   - agenda slides: include "items" with [{"title": "Topic"}] for each section
   - quote slides: include "quote" text and "attribution"
3. Call create_presentation with returnUrl: true
4. Share the download URL with the user

CRITICAL: Do NOT send slides with only a title. Always include the body, items, columns, or other content fields with actual text. Look at the "example" field from list_slide_types and follow that pattern exactly.

Always set returnUrl: true. Use paletteName to pick a color theme. Add aiImage: {prompt: "..."} on image-text and full-image slides for AI-generated visuals.

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
