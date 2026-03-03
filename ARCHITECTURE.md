# HoloDex — Architecture Document

## Why Agent-Driven is Better Than Microsoft Copilot

### The Problem with Microsoft Copilot for PowerPoint

Microsoft Copilot's PowerPoint integration is constrained by:

1. **Template-bound generation** — Relies on existing PowerPoint templates and layouts, producing generic-looking slides
2. **Limited visual creativity** — Cannot generate complex visual compositions, custom shapes, or rich data visualizations
3. **Shallow formatting** — Tends to produce bullet-point heavy slides with minimal visual design
4. **No programmatic control** — Cannot be called from other agents or automation workflows
5. **Brand adherence is basic** — Limited to pre-existing theme colors rather than deep brand integration
6. **No AI image generation** — Cannot generate contextual images inline during deck creation

### How HoloDex Achieves Superior Results

HoloDex takes a fundamentally different approach:

1. **Code-generation engine** — Uses PptxGenJS to programmatically create every element with pixel-perfect control
2. **Design-first architecture** — Follows explicit design guidelines (10 color palettes, typography scales, visual motifs, layout constants)
3. **Rich element support** — Charts (4 types), icons (4 libraries → rasterized PNG), shapes, gradients, shadows, tables, AI images
4. **22 slide types** — Each with a dedicated renderer optimized for its content type
5. **AI image generation** — DALL-E 3 / GPT-image-1 directly in slides with theme-aware prompting and rate-limit resilience
6. **MCP-native** — Built as an MCP server from day one, designed for agent-to-agent orchestration

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Azure Container App                          │
│  (auto-scaling 0–3 replicas, health probes, managed identity)    │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  MCP Server   │  │  REST API    │  │  File Store            │ │
│  │  (8 tools)    │  │  (Express)   │  │  (in-memory, 1h TTL)  │ │
│  │              │  │              │  │  GET /downloads/:id    │ │
│  │  Transports:  │  │  Routes:     │  └────────────────────────┘ │
│  │  • stdio      │  │  • /api/v1/* │                             │
│  │  • Streamable │  │  • /mcp      │                             │
│  │    HTTP       │  │              │                             │
│  └──────┬───────┘  └──────┬───────┘                             │
│         └──────────────────┤                                     │
│                     ┌──────▼──────┐                              │
│                     │ PPTX Engine │                              │
│                     │ (pptx-engine│                              │
│                     │  .ts)       │                              │
│                     └──────┬──────┘                              │
│                            │                                     │
│    ┌───────────────────────┼──────────────────────┐              │
│    │                       │                      │              │
│  ┌─▼──────────────┐ ┌─────▼──────────┐ ┌────────▼───────────┐  │
│  │ Theme Resolver  │ │ Slide          │ │ AI Image Provider  │  │
│  │ (10 palettes,   │ │ Renderers      │ │ (OpenAI, Azure     │  │
│  │  paletteName)   │ │ (22 types)     │ │  OpenAI)           │  │
│  └────────────────┘ └───────┬────────┘ │                     │  │
│                             │          │ • Sequential batch   │  │
│  ┌────────────────┐ ┌───────▼────────┐ │ • 429 retry logic   │  │
│  │ Brand Manager   │ │ Visual Motifs  │ │ • Entra ID auth     │  │
│  │ (persistent     │ │ (accent shapes,│ │ • DefaultAzure-     │  │
│  │  brands/)       │ │  decorators)   │ │   Credential        │  │
│  └────────────────┘ └───────┬────────┘ └─────────────────────┘  │
│                             │                                    │
│                      ┌──────▼──────┐                             │
│                      │  PptxGenJS  │                             │
│                      │  v3.12      │                             │
│                      └─────────────┘                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Azure Services                                          │   │
│  │  • Container Registry (ACR) — Docker image storage       │   │
│  │  • Blob Storage — PPTX output files                      │   │
│  │  • Application Insights — APM + telemetry                │   │
│  │  • Log Analytics — centralized logging                   │   │
│  │  • Managed Identity — passwordless RBAC                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. PPTX Engine (`src/engine/pptx-engine.ts`)

The orchestrator that receives a validated presentation request and coordinates all components:

- Resolves theme (palette, typography, fonts) via the Theme Resolver
- Detects AI image requests and delegates to the Image Provider
- Iterates slides and dispatches each to the appropriate renderer
- Supports three output formats: `buffer` (binary), `base64`, `file` (disk)
- Sanitizes filenames, manages output directory

### 2. Slide Renderers (`src/engine/slide-renderers.ts`)

22 dedicated renderer functions, one per slide type. Each renderer:

- Receives the slide definition, theme, and PptxGenJS slide object
- Applies layout constants from `layout.ts` (SLIDE_W=10, SLIDE_H=5.625, margins, body area)
- Renders text with `autoFit` for overflow protection
- Supports icons (rendered to PNG via react-icons + sharp), charts, images, shapes
- Applies visual motifs (accent decorations) via `motifs.ts`

**Slide types:** title, section, content, two-column, three-column, bullet-list, chart-bar, chart-line, chart-pie, chart-doughnut, comparison, stat-callout, timeline, image-text, full-image, icon-grid, quote, table, team, agenda, closing, blank

### 3. Theme Resolver (`src/engine/theme-resolver.ts`)

Resolves the visual identity for each presentation:

- 10 built-in palettes: midnight-executive, forest-moss, coral-energy, warm-terracotta, ocean-gradient, charcoal-minimal, teal-trust, berry-cream, sage-calm, cherry-bold
- Each palette defines: primary, secondary, accent, background, text, heading colors + gradient pair
- Typography scale: titleSize=40, subtitleSize=22, headingSize=24, bodySize=14, captionSize=11
- Supports `paletteName` shorthand (no inline color definitions needed)
- Merges brand overrides when a `brandName` is specified

### 4. Layout Constants (`src/engine/layout.ts`)

The spatial DNA of every slide:

- `SLIDE_W=10`, `SLIDE_H=5.625` (standard 16:9)
- `MARGIN_X=0.7`, `MARGIN_TOP=0.35`
- `CONTENT_W=8.6`, `BODY_Y=1.35`, `BODY_H=3.8`
- `CARD_PAD=0.25`, `GUTTER=0.35`
- Pre-calculated column widths for 2-col and 3-col layouts

### 5. Visual Motifs (`src/engine/motifs.ts`)

Decorative accent shapes applied to slides for visual polish:

- Corner accents, side bars, gradient strips
- Theme-aware: uses palette accent/secondary colors with transparency
- Applied per-slide based on slide type

### 6. AI Image Provider (`src/ai/image-provider.ts`)

Handles AI image generation with two provider backends:

| Provider | Auth | Model |
|----------|------|-------|
| **OpenAI** | API key (`OPENAI_API_KEY`) | DALL-E 3, GPT-image-1 |
| **Azure OpenAI** | API key or Entra ID (`DefaultAzureCredential`) | DALL-E 3 |

Key features:
- **Sequential batch generation** — generates images one at a time to avoid rate limits
- **429 rate-limit retry** — parses `retry-after` header, waits, retries automatically
- **Prompt Generator** (`prompt-generator.ts`) — enriches prompts with theme colors and style context
- **Image caching** — generated images are cached in-memory during request lifecycle

### 7. Brand Manager (`src/engine/brand-manager.ts`)

Persistent brand configuration management:

- Register brands with company colors, fonts, logos, taglines
- Brands stored in `brands/` directory as JSON
- Loaded at startup, available across all requests
- Logo URLs and background images supported
- Overrides theme palette when `brandName` is specified

### 8. MCP Server (`src/mcp-server.ts`)

8 MCP tools exposed via the Model Context Protocol:

| Tool | Description |
|------|-------------|
| `create_presentation` | Generate PPTX from structured slide definitions |
| `create_quick_presentation` | Generate from a simple text outline |
| `generate_image` | Generate a standalone AI image |
| `list_slide_types` | Get available slide types with schemas |
| `list_palettes` | Get available color palettes |
| `register_brand` | Register a company brand configuration |
| `list_brands` | List registered brands |
| `get_design_tips` | Get design guidance by topic |

Transports:
- **stdio** — for Claude Desktop, Cline, local agents (`MODE=mcp-stdio`)
- **StreamableHTTP** — for Agent365, remote agents, Copilot Studio (`MODE=mcp-http` or `MODE=all`)

### 9. REST API (`src/api.ts`)

Express-based HTTP API with routes:

- `POST /api/v1/presentations` — Generate PPTX (buffer, base64, or file)
- `POST /api/v1/presentations/download` — Generate and return as file download
- `POST /api/v1/presentations/quick` — Quick generation from outline
- `GET /api/v1/downloads/:id` — Download stored PPTX (from `returnUrl` flow)
- `GET/POST/DELETE /api/v1/brands/*` — Brand CRUD
- `GET /api/v1/palettes` — List palettes
- `GET /api/v1/slide-types` — List slide types
- `POST /api/v1/images/generate` — Standalone image generation
- `GET /api/v1/health` — Health check
- `GET /api/v1/info` — Service capabilities

### 10. File Store (`src/utils/file-store.ts`)

In-memory file storage for the `returnUrl` pattern:

- Generated PPTX files stored with UUID keys
- 1-hour TTL with automatic cleanup
- Returns download URLs consumable by Copilot Studio or OneDrive MCP
- Avoids base64 transfer limits in chat-based agents

## Slide Types

| Type | Description |
|------|-------------|
| `title` | Bold title slide with subtitle |
| `section` | Dark section divider / chapter break |
| `content` | Multi-paragraph text with optional image |
| `two-column` | Side-by-side content cards |
| `three-column` | Triple column card layout |
| `bullet-list` | Key points with icons and optional sub-items |
| `chart-bar` | Bar chart with multi-series data |
| `chart-line` | Line chart with trend data |
| `chart-pie` | Pie chart for distributions |
| `chart-doughnut` | Doughnut chart variant |
| `comparison` | Pro/con or A vs B layout |
| `stat-callout` | Large number callouts (2–4 stats) |
| `timeline` | Horizontal timeline with events |
| `image-text` | Image alongside text content |
| `full-image` | Full-bleed hero image with text overlay and scrim |
| `icon-grid` | Grid of icons with labels and descriptions |
| `quote` | Centered quote with attribution |
| `table` | Data table with headers and rows |
| `team` | Team member cards with roles |
| `agenda` | Numbered agenda items |
| `closing` | Thank you / closing slide |
| `blank` | Empty canvas for custom elements |

## Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Runtime** | Node.js (TypeScript) | v20+ |
| **PPTX Generation** | PptxGenJS | v3.12 |
| **Icons** | react-icons + sharp | SVG → PNG rasterization with caching |
| **HTTP Server** | Express.js | v4 |
| **MCP Server** | @modelcontextprotocol/sdk | v1.27 |
| **Schema Validation** | Zod | v3 |
| **Azure Identity** | @azure/identity | DefaultAzureCredential |
| **Container** | Docker (Alpine) | node:20-alpine |
| **Infrastructure** | Azure Bicep | Container Apps, ACR, Storage, App Insights |
| **Deployment** | Azure Developer CLI (azd) | One-command deploy |

## Request Flow

```
User/Agent
    │
    ├─── MCP Tool Call (POST /mcp) ──┐
    │                                │
    └─── REST API (POST /api/v1/) ───┤
                                     │
                              ┌──────▼──────┐
                              │  Validate    │ ← Zod schemas
                              │  Request     │
                              └──────┬──────┘
                                     │
                              ┌──────▼──────┐
                              │  Resolve     │ ← paletteName → full palette
                              │  Theme       │ ← brand overrides
                              └──────┬──────┘
                                     │
                              ┌──────▼──────┐
                              │  Generate    │ ← Sequential, 429 retry
                              │  AI Images   │ ← DALL-E 3 / GPT-image-1
                              └──────┬──────┘
                                     │
                              ┌──────▼──────┐
                              │  Render Each │ ← 22 type-specific renderers
                              │  Slide       │ ← layout constants, motifs
                              └──────┬──────┘
                                     │
                              ┌──────▼──────┐
                              │  Write PPTX  │ ← PptxGenJS
                              │  Output      │ ← buffer / base64 / file
                              └──────┬──────┘
                                     │
                              ┌──────▼──────┐
                              │  Return      │ ← Binary, JSON, or downloadUrl
                              │  Response    │
                              └─────────────┘
```

## File Structure

```
src/
├── index.ts                 # Entry point, mode selection, StreamableHTTP setup
├── api.ts                   # Express REST API routes
├── mcp-server.ts            # MCP server (8 tools, stdio transport)
├── schemas.ts               # Zod schemas for all 22 slide types + theme + brand
├── ai/
│   ├── index.ts             # AI module exports
│   ├── image-provider.ts    # OpenAI + Azure OpenAI providers, batch + retry
│   └── prompt-generator.ts  # Theme-aware prompt enrichment
├── engine/
│   ├── index.ts             # Engine exports
│   ├── pptx-engine.ts       # Orchestrator: theme → images → render → output
│   ├── slide-renderers.ts   # 22 slide type renderers (~2400 lines)
│   ├── theme-resolver.ts    # 10 palettes, typography, brand merge
│   ├── layout.ts            # Spatial constants (margins, widths, heights)
│   ├── motifs.ts            # Decorative accent shapes
│   └── brand-manager.ts     # Persistent brand CRUD
├── utils/
│   ├── file-store.ts        # In-memory PPTX store (returnUrl pattern)
│   └── logger.ts            # Winston logger
└── examples/
    ├── generate-sample.ts   # Sample deck generator
    └── killer-deck.ts       # Cinematic showcase deck example

infra/
└── main.bicep               # Azure infrastructure (Container App, ACR, Storage, etc.)

output/                      # Generated PPTX files (gitignored)
brands/                      # Persistent brand configurations
```
