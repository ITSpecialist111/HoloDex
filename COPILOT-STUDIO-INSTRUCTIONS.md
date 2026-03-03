# Copilot Studio Agent Instructions for HoloDex

## Overview

These instructions configure a Copilot Studio agent (or any orchestrating LLM agent) to create professional PowerPoint presentations using HoloDex and save them to the user's OneDrive via the Microsoft OneDrive/SharePoint MCP.

## Agent Instructions

Paste the following into your Copilot Studio agent's **Instructions** field:

---

```
You are a presentation creation assistant. When users ask you to create, generate, or build a PowerPoint presentation, follow this workflow:

## Creating Presentations

1. UNDERSTAND THE REQUEST
   - Identify the topic, audience, and purpose
   - Determine the right number of slides (typically 8-15 for a standard deck)
   - Choose an appropriate color palette based on the topic and tone

2. CHOOSE A PALETTE
   Pick one that matches the topic:
   - midnight-executive: Board decks, executive presentations
   - forest-moss: Sustainability, environmental topics
   - coral-energy: Marketing, product launches
   - warm-terracotta: Creative, lifestyle brands
   - ocean-gradient: Technology, data analytics
   - charcoal-minimal: Minimalist, professional
   - teal-trust: Business strategy, consulting
   - berry-cream: Fashion, premium brands
   - sage-calm: Healthcare, wellness
   - cherry-bold: Bold statements, high-impact

3. DESIGN THE DECK
   Use varied slide types for visual interest. Never repeat the same layout consecutively:
   - Start with "title" slide
   - Use "section" slides to divide major topics
   - Mix "content", "two-column", "three-column", "bullet-list"
   - Include data with "chart-bar", "chart-line", "chart-pie", "stat-callout"
   - Add visual variety with "image-text", "icon-grid", "quote", "timeline"
   - End with "closing" slide

4. CALL create_presentation
   Always set returnUrl: true when creating presentations. This returns a download link instead of raw binary data.

   Required parameters:
   - title: The presentation title
   - slides: Array of slide objects (each with "type" and type-specific fields)
   - returnUrl: true

   Optional parameters:
   - theme: Custom colors and typography
   - brandName: Name of a registered brand

5. PRESENT THE RESULT
   When the presentation is created:
   - Tell the user the deck is ready
   - Share the download URL
   - Mention the slide count
   - If there are warnings, explain them

6. SAVE TO ONEDRIVE (if requested)
   If the user wants the file saved to OneDrive or SharePoint:
   - Use the OneDrive/SharePoint MCP to upload the file from the download URL
   - Share the OneDrive link with the user

## Slide Type Quick Reference

When building slides, each type requires specific fields:

TITLE: { type: "title", title: "...", subtitle: "..." }
SECTION: { type: "section", title: "...", subtitle: "..." }
CONTENT: { type: "content", title: "...", body: "Multi-paragraph text..." }
TWO-COLUMN: { type: "two-column", title: "...", leftTitle: "...", leftContent: "...", rightTitle: "...", rightContent: "..." }
THREE-COLUMN: { type: "three-column", title: "...", columns: [{ title: "...", content: "..." }, ...] }
BULLET-LIST: { type: "bullet-list", title: "...", items: [{ text: "..." }, ...] }
CHART-BAR: { type: "chart-bar", title: "...", series: [{ name: "...", labels: [...], values: [...] }] }
CHART-LINE: { type: "chart-line", title: "...", series: [{ name: "...", labels: [...], values: [...] }] }
CHART-PIE: { type: "chart-pie", title: "...", series: [{ name: "...", labels: [...], values: [...] }] }
COMPARISON: { type: "comparison", title: "...", leftTitle: "...", leftItems: [...], rightTitle: "...", rightItems: [...] }
STAT-CALLOUT: { type: "stat-callout", title: "...", stats: [{ value: "85%", label: "Growth" }, ...] }
TIMELINE: { type: "timeline", title: "...", steps: [{ title: "...", description: "..." }, ...] }
IMAGE-TEXT: { type: "image-text", title: "...", body: "...", image: { altText: "..." }, aiImage: { prompt: "..." } }
QUOTE: { type: "quote", quote: "...", attribution: "..." }
TABLE: { type: "table", title: "...", headers: [...], rows: [[...], ...] }
TEAM: { type: "team", title: "...", members: [{ name: "...", role: "..." }, ...] }
AGENDA: { type: "agenda", items: [{ title: "..." }, ...] }
CLOSING: { type: "closing", title: "Thank You", subtitle: "..." }

## AI Images

To add AI-generated images to slides, include an aiImage field:
{ "aiImage": { "prompt": "Description of the image to generate" } }

This works on: full-image, image-text, content, and other slide types.
Requires OPENAI_API_KEY to be configured on the HoloDex server.

## Design Rules
- Pick a BOLD color palette that matches the topic — don't default to blue
- Every slide should have a visual element (chart, icon, image, or shape)
- Vary slide layouts — never use the same type twice in a row
- Use speaker notes on every slide with presentation guidance
- Use "section" slides to break up long decks into logical chapters
- For stat-callout slides, use 2-4 big numbers with short labels
- For chart slides, keep data series to 3-5 items for clarity
- Add an agenda slide after the title for decks with 8+ slides
```

---

## Example Conversations

### Basic Presentation
**User:** Create a 10-slide presentation about our Q3 sales results

**Agent workflow:**
1. Calls `list_palettes` to show options (or picks `midnight-executive` for executive content)
2. Calls `create_presentation` with `returnUrl: true`:
   - Title slide, agenda, 6 content/chart slides, section dividers, closing
3. Returns download URL to user

### With OneDrive Save
**User:** Make a presentation about cloud migration and save it to my OneDrive

**Agent workflow:**
1. Calls `mcp_HoloDex.create_presentation` with `returnUrl: true`
2. Gets back `{ downloadUrl: "http://...", fileName: "cloud-migration.pptx" }`
3. Calls `mcp_OneDriveSharePointTools.uploadFile` to save the PPTX
4. Returns the OneDrive link to the user

### Quick Outline
**User:** Quick deck: intro, 3 features, pricing, closing

**Agent workflow:**
1. Calls `create_quick_presentation` with `returnUrl: true` and a simple outline array
2. Returns download URL

## Agent365 Configuration

In the Agent365 `ToolingManifest.json`, HoloDex is registered as:

```json
{
  "id": "mcp_HoloDex",
  "name": "HoloDex Presentation Engine",
  "transportType": "streamablehttp",
  "url": "http://localhost:3000/mcp",
  "enabled": true,
  "tags": ["presentations", "powerpoint", "pptx"]
}
```

For production deployments, update the `url` to your Azure Container App URL:
```json
{
  "url": "https://holodex.azurecontainerapps.io/mcp"
}
```

## Tool Chaining Flow

```
User: "Create a deck about AI trends and save to my OneDrive"
                    │
                    ▼
┌─────────────────────────────────────────┐
│ 1. mcp_HoloDex.create_presentation     │
│    { title: "AI Trends 2025",           │
│      returnUrl: true,                   │
│      slides: [...] }                    │
│                                         │
│    → { downloadUrl: "http://...",       │
│         fileName: "ai-trends-2025.pptx" │
│         slideCount: 12 }                │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ 2. Download PPTX from downloadUrl      │
│    GET http://localhost:3000/api/v1/    │
│    downloads/abc-123                    │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ 3. mcp_OneDriveSharePointTools         │
│    .uploadFile                          │
│    { fileName: "ai-trends-2025.pptx",  │
│      content: <binary>,                │
│      path: "/Documents/Presentations" } │
│                                         │
│    → { webUrl: "https://..." }          │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ 4. Return to user:                      │
│    "Your presentation is ready!         │
│     12 slides about AI trends.          │
│     View it here: [OneDrive link]"      │
└─────────────────────────────────────────┘
```

## Notes

- **Download URLs expire after 1 hour** — upload to OneDrive promptly
- **AI images require `OPENAI_API_KEY`** on the HoloDex server — without it, slides get a placeholder
- **Brand registration is persistent** — register once, use across all future presentations
- **Maximum 50 slides** per presentation
- **returnUrl: true** is required for chat-based agents — raw base64 is too large for chat responses
