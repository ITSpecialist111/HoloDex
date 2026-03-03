import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { pptxEngine } from './engine/pptx-engine.js';
import { brandManager, BrandManager } from './engine/brand-manager.js';
import { listPresetPalettes } from './engine/theme-resolver.js';
import { fileStore } from './utils/file-store.js';
import {
  PresentationRequestSchema,
  SlideSchema,
  BrandConfigSchema,
  DesignThemeSchema,
  PRESET_PALETTES,
} from './schemas.js';
import type { PresentationRequest, Slide, BrandConfig } from './schemas.js';
import { imageManager } from './ai/image-provider.js';
import { logger } from './utils/logger.js';

/**
 * MCP Server for HoloDex.
 * Exposes tools for AI agents to generate rich PowerPoint presentations.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'holodex',
    version: '1.0.0',
  });

  // ================================================================
  // TOOL: create_presentation
  // Full presentation generation from structured request
  // ================================================================
  server.tool(
    'create_presentation',
    'Generate a complete PowerPoint presentation with rich formatting, charts, icons, and professional design. Supports 1-50 slides with 20+ slide types.',
    {
      title: z.string().describe('Presentation title'),
      author: z.string().optional().describe('Author name'),
      description: z.string().optional().describe('Brief description of the presentation purpose'),
      slides: z.array(z.any()).min(1).max(50).describe('Array of slide definitions. Each slide must have a "type" field. See list_slide_types for available types and their schemas.'),
      theme: z.object({
        palette: z.object({
          primary: z.string().describe('Primary color (6-char hex, no #)'),
          secondary: z.string().describe('Secondary color'),
          accent: z.string().describe('Accent color'),
        }).optional(),
        typography: z.object({
          headerFont: z.string().optional(),
          bodyFont: z.string().optional(),
        }).optional(),
        visualMotif: z.enum(['icons-in-circles', 'accent-borders', 'rounded-cards', 'sharp-geometric', 'minimal-lines', 'gradient-headers']).optional(),
      }).optional().describe('Custom theme settings'),
      brandName: z.string().optional().describe('Name of a previously registered brand to apply'),
      returnUrl: z.boolean().optional().default(false).describe('If true, returns a download URL instead of base64 data. Use this for Copilot Studio or chat-based clients where users need a clickable link.'),
    },
    async (args) => {
      try {
        let brand: BrandConfig | undefined;
        if (args.brandName) {
          brand = (await brandManager.getBrand(args.brandName)) || undefined;
          if (!brand) {
            return {
              content: [{ type: 'text' as const, text: `Brand "${args.brandName}" not found. Use list_brands to see available brands.` }],
              isError: true,
            };
          }
        }

        const request: PresentationRequest = {
          title: args.title,
          author: args.author,
          description: args.description,
          slides: args.slides as Slide[],
          theme: args.theme as any,
          brand,
          outputFormat: args.returnUrl ? 'buffer' : 'base64',
        };

        const result = await pptxEngine.generate(request);

        if (!result.success) {
          return {
            content: [{ type: 'text' as const, text: `Generation failed: ${result.errors?.join(', ')}` }],
            isError: true,
          };
        }

        // When returnUrl is set, store the file and return a download link
        if (args.returnUrl && result.buffer) {
          const baseUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
          const stored = fileStore.store(result.buffer, result.fileName, result.slideCount, result.warnings);
          const downloadUrl = fileStore.downloadUrl(stored.id, baseUrl);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                fileName: result.fileName,
                slideCount: result.slideCount,
                downloadUrl,
                expiresIn: '1 hour',
                warnings: result.warnings,
              }),
            }],
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                fileName: result.fileName,
                slideCount: result.slideCount,
                base64: result.base64,
                warnings: result.warnings,
              }),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP create_presentation error', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    },
  );

  // ================================================================
  // TOOL: create_quick_presentation
  // Simplified presentation creation from text outline
  // ================================================================
  server.tool(
    'create_quick_presentation',
    'Create a quick presentation from a simple text outline. Each item becomes a slide. Ideal for rapid prototyping.',
    {
      title: z.string().describe('Presentation title'),
      outline: z.array(z.object({
        title: z.string(),
        body: z.string().optional(),
        type: z.enum(['title', 'content', 'section', 'bullet-list', 'closing']).optional().default('content'),
        speakerNotes: z.string().optional(),
      })).min(1).max(50).describe('Simple outline items'),
      paletteName: z.string().optional().describe('Preset palette name (use list_palettes to see options)'),
      brandName: z.string().optional().describe('Brand name to apply'),
      returnUrl: z.boolean().optional().default(false).describe('If true, returns a download URL instead of base64 data. Use this for Copilot Studio or chat-based clients.'),
    },
    async (args) => {
      try {
        const palette = args.paletteName
          ? PRESET_PALETTES[args.paletteName]
          : PRESET_PALETTES['teal-trust'];

        if (args.paletteName && !palette) {
          return {
            content: [{ type: 'text' as const, text: `Unknown palette: ${args.paletteName}. Use list_palettes to see options.` }],
            isError: true,
          };
        }

        let brand: BrandConfig | undefined;
        if (args.brandName) {
          brand = (await brandManager.getBrand(args.brandName)) || undefined;
        }

        const slides: Slide[] = args.outline.map((item, i) => {
          if (i === 0 || item.type === 'title') {
            return {
              type: 'title' as const,
              title: item.title,
              subtitle: item.body,
              speakerNotes: item.speakerNotes,
            };
          }
          if (item.type === 'section') {
            return {
              type: 'section' as const,
              title: item.title,
              subtitle: item.body,
              sectionNumber: i,
              speakerNotes: item.speakerNotes,
            };
          }
          if (item.type === 'closing') {
            return {
              type: 'closing' as const,
              title: item.title,
              subtitle: item.body,
              speakerNotes: item.speakerNotes,
            };
          }
          if (item.type === 'bullet-list' && item.body) {
            return {
              type: 'bullet-list' as const,
              title: item.title,
              items: item.body.split('\n').filter(l => l.trim()).map(l => ({
                text: l.replace(/^[-•*]\s*/, ''),
              })),
              speakerNotes: item.speakerNotes,
            };
          }
          return {
            type: 'content' as const,
            title: item.title,
            body: item.body || '',
            speakerNotes: item.speakerNotes,
          };
        });

        const result = await pptxEngine.generate(PresentationRequestSchema.parse({
          title: args.title,
          slides,
          theme: palette ? { palette } : undefined,
          brand,
          outputFormat: args.returnUrl ? 'buffer' : 'base64',
        }));

        if (!result.success) {
          return {
            content: [{ type: 'text' as const, text: `Generation failed: ${result.errors?.join(', ')}` }],
            isError: true,
          };
        }

        // When returnUrl is set, store the file and return a download link
        if (args.returnUrl && result.buffer) {
          const baseUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
          const stored = fileStore.store(result.buffer, result.fileName, result.slideCount, result.warnings);
          const downloadUrl = fileStore.downloadUrl(stored.id, baseUrl);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                fileName: result.fileName,
                slideCount: result.slideCount,
                downloadUrl,
                expiresIn: '1 hour',
                warnings: result.warnings,
              }),
            }],
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              fileName: result.fileName,
              slideCount: result.slideCount,
              base64: result.base64,
              warnings: result.warnings,
            }),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    },
  );

  // ================================================================
  // TOOL: list_slide_types
  // ================================================================
  server.tool(
    'list_slide_types',
    'List all available slide types with their required and optional fields.',
    {},
    async () => {
      const slideTypes = {
        title: {
          description: 'Bold title slide with subtitle, ideal for opening',
          required: ['title'],
          optional: ['subtitle', 'author', 'date', 'speakerNotes'],
        },
        section: {
          description: 'Section divider / chapter break',
          required: ['title'],
          optional: ['subtitle', 'sectionNumber', 'speakerNotes'],
        },
        content: {
          description: 'General content with text and optional image',
          required: ['title', 'body'],
          optional: ['image', 'icon', 'speakerNotes'],
        },
        'two-column': {
          description: 'Side-by-side content in two columns with accent borders',
          required: ['title', 'leftContent', 'rightContent'],
          optional: ['leftTitle', 'rightTitle', 'leftIcon', 'rightIcon', 'speakerNotes'],
        },
        'three-column': {
          description: 'Triple column layout with cards',
          required: ['title', 'columns'],
          optional: ['speakerNotes'],
          columns_schema: '{ title?: string, content: string, icon?: IconRef }',
        },
        'bullet-list': {
          description: 'Key points with proper bullets',
          required: ['title', 'items'],
          optional: ['speakerNotes'],
          items_schema: '{ text: string, subItems?: string[], icon?: IconRef }',
        },
        'chart-bar': {
          description: 'Bar/column chart with optional commentary',
          required: ['title', 'series'],
          optional: ['commentary', 'horizontal', 'stacked', 'speakerNotes'],
          series_schema: '{ name: string, labels: string[], values: number[] }',
        },
        'chart-line': {
          description: 'Line/trend chart with smooth curves',
          required: ['title', 'series'],
          optional: ['commentary', 'smooth', 'speakerNotes'],
        },
        'chart-pie': {
          description: 'Pie chart with percentages',
          required: ['title', 'series'],
          optional: ['commentary', 'showPercent', 'speakerNotes'],
        },
        'chart-doughnut': {
          description: 'Doughnut chart variant',
          required: ['title', 'series'],
          optional: ['commentary', 'showPercent', 'speakerNotes'],
        },
        comparison: {
          description: 'Before/after or pros/cons comparison',
          required: ['title', 'leftTitle', 'leftItems', 'rightTitle', 'rightItems'],
          optional: ['leftColor', 'rightColor', 'speakerNotes'],
        },
        'stat-callout': {
          description: 'Big number emphasis with stat cards',
          required: ['stats'],
          optional: ['title', 'speakerNotes'],
          stats_schema: '{ value: string, label: string, icon?: IconRef }',
        },
        timeline: {
          description: 'Process flow with connected steps',
          required: ['title', 'steps'],
          optional: ['speakerNotes'],
          steps_schema: '{ title: string, description?: string, icon?: IconRef }',
        },
        'image-text': {
          description: 'Half-bleed image with text on the other side',
          required: ['title', 'body', 'image'],
          optional: ['imagePosition', 'speakerNotes'],
          image_schema: '{ url?: string, base64?: string, altText?: string }',
        },
        'icon-grid': {
          description: '2x2 or 2x3 grid with icons in colored circles',
          required: ['title', 'items'],
          optional: ['speakerNotes'],
          items_schema: '{ title: string, description?: string, icon: IconRef }',
        },
        quote: {
          description: 'Quote/testimonial with attribution on dark background',
          required: ['quote'],
          optional: ['attribution', 'role', 'speakerNotes'],
        },
        table: {
          description: 'Data table with alternating row colors',
          required: ['title', 'headers', 'rows'],
          optional: ['columnWidths', 'speakerNotes'],
        },
        team: {
          description: 'Team member profiles with avatars',
          required: ['title', 'members'],
          optional: ['speakerNotes'],
          members_schema: '{ name: string, role: string, description?: string, imageBase64?: string }',
        },
        closing: {
          description: 'Thank you / contact slide',
          required: [],
          optional: ['title', 'subtitle', 'contactInfo', 'speakerNotes'],
        },
        agenda: {
          description: 'Table of contents with numbered items',
          required: ['items'],
          optional: ['title', 'speakerNotes'],
          items_schema: '{ title: string, description?: string, duration?: string }',
        },
        'full-image': {
          description: 'Full-bleed hero image slide with optional text overlay. Supports AI-generated images via aiImage field.',
          required: [],
          optional: ['title', 'subtitle', 'image', 'aiImage', 'overlayPosition', 'scrim', 'speakerNotes'],
          aiImage_schema: '{ prompt?: string, size?: string, style?: "natural"|"vivid", quality?: string, placement?: string, styleNotes?: string }',
          note: 'Set aiImage.prompt to generate an AI image. Requires OPENAI_API_KEY, AZURE_OPENAI_API_KEY, or Azure Entra ID auth.',
        },
      };

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(slideTypes, null, 2),
        }],
      };
    },
  );

  // ================================================================
  // TOOL: list_palettes
  // ================================================================
  server.tool(
    'list_palettes',
    'List available preset color palettes with their colors.',
    {},
    async () => {
      const palettes = Object.entries(PRESET_PALETTES).map(([name, palette]) => ({
        name,
        primary: palette.primary,
        secondary: palette.secondary,
        accent: palette.accent,
        backgroundDark: palette.backgroundDark,
      }));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(palettes, null, 2),
        }],
      };
    },
  );

  // ================================================================
  // TOOL: register_brand
  // ================================================================
  server.tool(
    'register_brand',
    'Register a company brand with colors, fonts, logo, and tone of voice for consistent presentations.',
    {
      name: z.string().describe('Brand identifier name'),
      companyName: z.string().describe('Full company name'),
      primaryColor: z.string().describe('Primary brand color (6-char hex)'),
      secondaryColor: z.string().describe('Secondary brand color (6-char hex)'),
      accentColor: z.string().optional().describe('Accent color (6-char hex)'),
      headerFont: z.string().optional().describe('Header font name'),
      bodyFont: z.string().optional().describe('Body font name'),
      toneOfVoice: z.enum(['formal', 'friendly', 'technical', 'creative', 'authoritative']).optional(),
      tagline: z.string().optional().describe('Company tagline'),
      logoBase64: z.string().optional().describe('Logo as base64 data string'),
    },
    async (args) => {
      try {
        const config = BrandManager.createBrandConfig({
          companyName: args.companyName,
          primaryColor: args.primaryColor,
          secondaryColor: args.secondaryColor,
          accentColor: args.accentColor,
          headerFont: args.headerFont,
          bodyFont: args.bodyFont,
          toneOfVoice: args.toneOfVoice,
          tagline: args.tagline,
          logoBase64: args.logoBase64,
        });

        await brandManager.registerBrand(args.name, config);

        return {
          content: [{
            type: 'text' as const,
            text: `Brand "${args.name}" registered successfully for ${args.companyName}`,
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    },
  );

  // ================================================================
  // TOOL: generate_image
  // Standalone AI image generation
  // ================================================================
  server.tool(
    'generate_image',
    'Generate an AI image using DALL-E 3 or GPT-image-1. Returns base64 PNG. Requires OPENAI_API_KEY, AZURE_OPENAI_API_KEY, or Azure Entra ID auth.',
    {
      prompt: z.string().describe('Text prompt describing the image to generate'),
      size: z.enum(['1024x1024', '1792x1024', '1024x1792', '512x512', '256x256']).optional().default('1792x1024').describe('Image dimensions'),
      style: z.enum(['natural', 'vivid']).optional().default('natural').describe('natural = photorealistic, vivid = hyper-real/dramatic'),
      quality: z.enum(['standard', 'high', 'hd', 'low', 'medium', 'auto']).optional().default('auto').describe('Quality tier'),
    },
    async (args) => {
      try {
        if (!imageManager.isAvailable) {
          return {
            content: [{
              type: 'text' as const,
              text: 'AI image generation not available. Set OPENAI_API_KEY or AZURE_OPENAI_API_KEY environment variable.',
            }],
            isError: true,
          };
        }

        const result = await imageManager.generate({
          prompt: args.prompt,
          size: args.size,
          style: args.style,
          quality: args.quality,
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              base64: result.base64,
              revisedPrompt: result.revisedPrompt,
              width: result.width,
              height: result.height,
              provider: result.provider,
              generationTimeMs: result.generationTimeMs,
            }),
          }],
        };
      } catch (error) {
        logger.error('MCP generate_image error', error);
        return {
          content: [{ type: 'text' as const, text: `Image generation failed: ${error}` }],
          isError: true,
        };
      }
    },
  );

  // ================================================================
  // TOOL: list_brands
  // ================================================================
  server.tool(
    'list_brands',
    'List all registered brand configurations.',
    {},
    async () => {
      const brands = await brandManager.listBrands();
      return {
        content: [{
          type: 'text' as const,
          text: brands.length > 0
            ? `Available brands: ${brands.join(', ')}`
            : 'No brands registered. Use register_brand to add one.',
        }],
      };
    },
  );

  // ================================================================
  // TOOL: get_design_tips
  // ================================================================
  server.tool(
    'get_design_tips',
    'Get design best practices and tips for creating effective presentations.',
    {
      topic: z.enum(['general', 'colors', 'typography', 'layout', 'charts', 'common-mistakes']).optional().default('general'),
    },
    async (args) => {
      const tips: Record<string, string> = {
        general: `DESIGN BEST PRACTICES:
• Pick a bold, content-informed color palette specific to the topic
• One color should dominate (60-70% visual weight) with 1-2 supporting tones
• Dark backgrounds for title + conclusion slides, light for content ("sandwich" structure)
• Commit to ONE visual motif and repeat it (e.g., icons in colored circles, accent borders)
• Every slide needs a visual element — image, chart, icon, or shape
• Vary layouts across slides — don't repeat the same format
• Leave breathing room — don't fill every inch
• Include speaker notes for presentation guidance`,

        colors: `COLOR PALETTE TIPS:
• Don't default to blue — pick colors that reflect the specific topic
• Use 60-30-10 rule: 60% dominant, 30% secondary, 10% accent
• Dark/light contrast between header and content slides
• Ensure text has strong contrast against backgrounds
• Available presets: ${listPresetPalettes().join(', ')}
• Use chart colors derived from your palette for consistency`,

        typography: `TYPOGRAPHY TIPS:
• Choose an interesting font pairing — header with personality, clean body font
• Recommended pairings: Georgia+Calibri, Arial Black+Arial, Trebuchet MS+Calibri
• Slide title: 36-44pt bold
• Section header: 20-24pt bold
• Body text: 14-16pt
• Captions: 10-12pt muted
• Left-align paragraphs and lists; center only titles
• Don't skimp on size contrast between titles and body`,

        layout: `LAYOUT TIPS:
• Two-column: text left, illustration right
• Icon + text rows: icon in colored circle, bold header, description
• 2x2 or 2x3 grids for feature/benefit displays
• Half-bleed image with content overlay for visual impact
• Large stat callouts: big numbers (60-72pt) with small labels
• Timeline/process flow for sequential information
• 0.5" minimum margins, 0.3-0.5" between content blocks`,

        charts: `CHART TIPS:
• Use custom colors from your presentation palette, not defaults
• Clean backgrounds with rounded corners
• Muted axis labels in gray (64748B)
• Subtle grid lines only on value axis
• Data labels on bars/points for clarity
• Hide legend for single series charts
• Add commentary text beside charts for context
• Line charts: use smooth curves and markers`,

        'common-mistakes': `COMMON MISTAKES TO AVOID:
• Don't repeat the same layout on every slide
• Don't center body text — left-align paragraphs
• Don't use text-only slides — always add visual elements
• Don't default to blue — match colors to topic
• Don't mix spacing randomly — consistent 0.3" or 0.5" gaps
• Don't style one slide and leave rest plain
• Don't use low-contrast elements
• Don't create bullet-heavy slides — use visual alternatives
• Don't forget speaker notes
• NEVER use accent lines under titles (hallmark of AI slides)`,
      };

      return {
        content: [{
          type: 'text' as const,
          text: tips[args.topic] || tips['general'],
        }],
      };
    },
  );

  return server;
}

/**
 * Start MCP server with stdio transport (for agent integration)
 */
export async function startMcpStdio(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('MCP server started with stdio transport');
}
