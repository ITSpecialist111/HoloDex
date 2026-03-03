# HoloDex - Architecture Document

## Why Claude is Better at PowerPoint Than Microsoft Copilot

### Analysis

Microsoft Copilot's PowerPoint integration is constrained by:
1. **Template-bound generation** - It relies heavily on existing PowerPoint templates and layouts, producing generic-looking slides
2. **Limited visual creativity** - Cannot generate complex visual compositions, custom shapes, or rich data visualizations
3. **Shallow formatting** - Tends to produce bullet-point heavy slides with minimal visual design
4. **No programmatic control** - Cannot execute code to generate charts, icons, or complex layouts
5. **Brand adherence is basic** - Limited to pre-existing theme colors rather than deep brand integration

### How Claude Achieves Superior Results

Claude's approach (via the PPTX skill) is fundamentally different:
1. **Code-generation approach** - Uses PptxGenJS to programmatically create every element with pixel-perfect control
2. **Design-first thinking** - Follows explicit design guidelines (color palettes, typography, spacing, visual motifs)
3. **Rich element support** - Charts, icons (react-icons → rasterized PNG), shapes, gradients, shadows, tables
4. **Template manipulation** - Can unpack PPTX files, manipulate raw XML, and repack with full control
5. **QA pipeline** - Renders slides to images and visually inspects for overlaps, alignment issues, contrast problems
6. **Content-informed design** - Palette choices, layout decisions, and visual motifs are driven by the actual content

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Azure Container App                         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  MCP Server   │  │  REST API    │  │  Agent Protocol      │  │
│  │  (stdio/SSE)  │  │  (Express)   │  │  (Agent-to-Agent)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └─────────────────┼──────────────────────┘              │
│                           │                                     │
│                    ┌──────▼──────┐                              │
│                    │ Orchestrator │                              │
│                    │   Engine     │                              │
│                    └──────┬──────┘                              │
│                           │                                     │
│         ┌─────────────────┼─────────────────────┐              │
│         │                 │                      │              │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌────────────▼──────────┐  │
│  │  Content     │  │  Design     │  │  Brand                │  │
│  │  Planner     │  │  Engine     │  │  Manager              │  │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬──────────┘  │
│         │                │                       │              │
│         └────────────────┼───────────────────────┘              │
│                          │                                      │
│                   ┌──────▼──────┐                               │
│                   │  PPTX       │                               │
│                   │  Generator  │                               │
│                   └──────┬──────┘                               │
│                          │                                      │
│         ┌────────────────┼──────────────────┐                  │
│         │                │                   │                  │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌────────▼────────┐       │
│  │ Slide Type   │  │  Chart      │  │  Icon            │       │
│  │ Renderers    │  │  Generator  │  │  Renderer        │       │
│  └─────────────┘  └─────────────┘  └──────────────────┘       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Template Engine                         │  │
│  │  (Unpack → Manipulate XML → Edit Content → Clean → Pack) │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │  Azure Blob     │  │  QA Pipeline   │  │  Health/Metrics  │  │
│  │  Storage        │  │  (Optional)    │  │  Endpoints       │  │
│  └────────────────┘  └────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Orchestrator Engine
- Receives high-level presentation requests
- Plans slide structure (number, type, flow)
- Coordinates content planning, design decisions, and generation
- Returns completed PPTX file or Azure Blob URL

### 2. Content Planner
- Takes user intent and breaks into slide-by-slide content plan
- Determines optimal slide count and flow
- Assigns slide types (title, content, chart, comparison, etc.)
- Generates speaker notes framework

### 3. Design Engine
- Selects color palette based on topic/mood
- Chooses typography pairing
- Establishes visual motif (icons in circles, accent borders, etc.)
- Ensures layout variety across slides

### 4. Brand Manager
- Loads company brand guidelines (colors, fonts, logos, tone)
- Can ingest master slide files (.pptx templates)
- Enforces brand consistency across all generated slides
- Supports brand asset storage (logos, icons, backgrounds)

### 5. PPTX Generator
- Core PptxGenJS-based generation engine
- 15+ slide type renderers
- Chart generation (bar, line, pie, doughnut, radar)
- Icon rendering (react-icons → sharp → PNG)
- Template-based editing (unpack/edit/pack workflow)

### 6. MCP Server
- Exposes tools via Model Context Protocol
- Supports both stdio and SSE transports
- Tools: create_presentation, create_slide, apply_brand, list_templates, etc.

### 7. REST API
- Express-based HTTP API
- OpenAPI/Swagger documented
- Supports async generation with webhook callbacks
- File upload for templates and brand assets

## Slide Types Supported

| Type | Description |
|------|------------|
| `title` | Bold title slide with subtitle |
| `section` | Section divider/chapter break |
| `content` | Text with optional image/icon |
| `two-column` | Side-by-side content |
| `three-column` | Triple column layout |
| `bullet-list` | Key points with icons |
| `chart-bar` | Bar/column chart with commentary |
| `chart-line` | Line/trend chart |
| `chart-pie` | Pie/doughnut chart |
| `comparison` | Before/after, pros/cons |
| `stat-callout` | Big number emphasis |
| `timeline` | Process flow / steps |
| `image-text` | Half-bleed image with text |
| `icon-grid` | 2x2 or 2x3 icon grid |
| `quote` | Quote/testimonial slide |
| `table` | Data table |
| `team` | Team member profiles |
| `closing` | Thank you / contact slide |
| `agenda` | Table of contents / agenda |
| `blank` | Custom layout canvas |

## Technology Stack

- **Runtime**: Node.js 20+ (TypeScript)
- **PPTX Generation**: PptxGenJS
- **Icons**: react-icons + sharp (SVG → PNG rasterization)
- **HTTP Server**: Express.js
- **MCP Server**: @modelcontextprotocol/sdk
- **Container**: Docker (Azure Container Apps)
- **Storage**: Azure Blob Storage (for generated files and brand assets)
- **Validation**: Zod schemas
- **Testing**: Vitest

## API Flow

```
User/Agent → MCP Tool Call or REST Request
           → Orchestrator validates & plans
           → Content Planner structures slides
           → Design Engine selects aesthetics
           → Brand Manager applies constraints (if branded)
           → PPTX Generator renders each slide
           → QA checks (optional)
           → Returns .pptx file / blob URL
```
