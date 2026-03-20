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

function getBaseUrl(): string {
  return process.env.PUBLIC_URL
    || (process.env.CONTAINER_APP_HOSTNAME ? `https://${process.env.CONTAINER_APP_HOSTNAME}` : '')
    || `http://localhost:${process.env.PORT || 3000}`;
}

/**
 * Auto-enrich slides that have correct structure but empty content.
 * Copilot Studio often sends the right types & titles but leaves
 * body, items, columns, and aiImage empty. This fills in sensible
 * defaults so the deck isn't blank.
 */
function enrichSlides(slides: any[], presentationTitle: string): any[] {
  const allTitles = slides.map((s: any) => s.title).filter(Boolean);

  return slides.map((slide: any, idx: number) => {
    const s = { ...slide };

    switch (s.type) {
      case 'agenda': {
        // Auto-populate agenda items from other slide titles
        if (!s.items?.length) {
          s.items = allTitles
            .filter((_: string, i: number) => i !== idx && slides[i]?.type !== 'title' && slides[i]?.type !== 'closing' && slides[i]?.type !== 'agenda')
            .map((t: string) => ({ title: t }));
        }
        break;
      }

      case 'content': {
        // If body is empty, generate a descriptive paragraph from the title
        if (!s.body?.trim()) {
          s.body = `This section covers ${s.title?.toLowerCase() || presentationTitle.toLowerCase()}. Key concepts and important details are explored in depth to provide a comprehensive understanding of the topic.`;
        }
        break;
      }

      case 'bullet-list': {
        // If items are empty, generate placeholder bullets from the title
        if (!s.items?.length) {
          const title = s.title || 'Key Points';
          s.items = [
            { text: `Overview of ${title.toLowerCase()}` },
            { text: `Key principles and fundamentals` },
            { text: `Practical applications and examples` },
            { text: `Best practices and recommendations` },
          ];
        }
        break;
      }

      case 'two-column': {
        if (!s.leftContent?.trim()) {
          s.leftTitle = s.leftTitle || 'Key Points';
          s.leftContent = `Important aspects and details about ${s.title?.toLowerCase() || 'this topic'}.`;
        }
        if (!s.rightContent?.trim()) {
          s.rightTitle = s.rightTitle || 'Details';
          s.rightContent = `Additional context and supporting information for a complete understanding.`;
        }
        break;
      }

      case 'three-column': {
        if (!s.columns?.length || s.columns.every((c: any) => !c?.content?.trim())) {
          s.columns = [
            { title: 'Overview', content: `Introduction to ${s.title?.toLowerCase() || 'the topic'} and its core principles.` },
            { title: 'Details', content: `Key details, methods, and approaches that define the subject.` },
            { title: 'Application', content: `Real-world applications, examples, and practical use cases.` },
          ];
        }
        break;
      }

      case 'image-text': {
        if (!s.body?.trim()) {
          s.body = `${s.title || presentationTitle} represents a key aspect of this presentation. This visual explores the concept through imagery and descriptive context.`;
        }
        // Auto-add aiImage if not present
        if (!s.aiImage && !s.image) {
          s.aiImage = { prompt: `Professional photograph related to ${s.title || presentationTitle}, clean modern style, high quality` };
        }
        break;
      }

      case 'full-image': {
        // Auto-add aiImage if not present
        if (!s.aiImage && !s.image) {
          s.aiImage = { prompt: `Stunning wide-angle photograph of ${s.title || presentationTitle}, professional quality, dramatic lighting` };
        }
        break;
      }

      case 'quote': {
        if (!s.quote?.trim()) {
          s.quote = `The beauty of ${presentationTitle.toLowerCase()} lies in its ability to inspire and transform.`;
          s.attribution = s.attribution || 'Unknown';
        }
        break;
      }

      case 'stat-callout': {
        if (!s.stats?.length) {
          s.stats = [
            { value: '100%', label: 'Engagement' },
            { value: '50+', label: 'Key Concepts' },
            { value: '∞', label: 'Possibilities' },
          ];
        }
        break;
      }

      case 'timeline': {
        if (!s.steps?.length) {
          s.steps = [
            { title: 'Beginning', description: 'The origins and early development' },
            { title: 'Growth', description: 'Expansion and increasing influence' },
            { title: 'Today', description: 'Current state and modern applications' },
          ];
        }
        break;
      }

      case 'comparison': {
        if (!s.leftItems?.length) {
          s.leftTitle = s.leftTitle || 'Advantages';
          s.leftItems = ['Clear benefits', 'Practical value', 'Wide applicability'];
        }
        if (!s.rightItems?.length) {
          s.rightTitle = s.rightTitle || 'Considerations';
          s.rightItems = ['Requirements', 'Learning curve', 'Resource needs'];
        }
        break;
      }

      case 'icon-grid': {
        if (!s.items?.length) {
          s.items = [
            { title: 'Concept', description: 'Core ideas and principles', icon: { name: 'lightbulb' } },
            { title: 'Method', description: 'Approaches and techniques', icon: { name: 'gear' } },
            { title: 'Result', description: 'Outcomes and impact', icon: { name: 'chart-line' } },
            { title: 'Future', description: 'Next steps and possibilities', icon: { name: 'rocket' } },
          ];
        }
        break;
      }
    }

    return s;
  });
}

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
    `Generate a complete PowerPoint presentation. IMPORTANT: Every slide MUST include full content, not just titles.

For each slide, include ALL required content fields:
- content slides: body with 2-3 sentences
- bullet-list: items array with 3-6 objects like {text: "point text"}
- two-column: leftContent and rightContent with text paragraphs, leftTitle and rightTitle
- three-column: columns array with 3 objects like {title: "Col", content: "text"}
- image-text: body with text AND aiImage: {prompt: "description for image"}
- full-image: aiImage: {prompt: "description for image"}
- agenda: items array with {title: "Topic"} for each section
- quote: quote text and attribution
- stat-callout: stats array with {value: "42%", label: "Growth"}

Add aiImage: {prompt: "..."} to image-text and full-image slides for AI-generated visuals.`,
    {
      title: z.string().describe('Presentation title'),
      author: z.string().optional().describe('Author name'),
      description: z.string().optional().describe('Brief description of the presentation purpose'),
      slides: z.array(z.any()).min(1).max(50).describe(
        'Array of slide objects. Each needs "type" plus FULL CONTENT. Example: ' +
        '[{"type":"title","title":"My Talk","subtitle":"A Deep Dive"},' +
        '{"type":"content","title":"Overview","body":"This presentation covers key concepts in detail..."},' +
        '{"type":"bullet-list","title":"Key Points","items":[{"text":"First important point"},{"text":"Second point"},{"text":"Third point"}]},' +
        '{"type":"image-text","title":"Visual","body":"Description of the concept.","aiImage":{"prompt":"professional photo of topic"}}]'
      ),
      theme: z.object({
        paletteName: z.string().optional().describe('Preset palette name (use list_palettes to see options). Ignored if palette is provided.'),
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
          slides: enrichSlides(args.slides, args.title) as Slide[],
          theme: args.theme as any,
          paletteName: args.theme?.paletteName,
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
          const baseUrl = getBaseUrl();
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
          const baseUrl = getBaseUrl();
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
          example: { type: 'title', title: 'My Presentation', subtitle: 'A comprehensive overview' },
        },
        section: {
          description: 'Section divider / chapter break',
          required: ['title'],
          optional: ['subtitle', 'sectionNumber', 'speakerNotes'],
          example: { type: 'section', title: 'Chapter 1: Introduction' },
        },
        content: {
          description: 'General content with text body (MUST include body text)',
          required: ['title', 'body'],
          optional: ['image', 'icon', 'speakerNotes'],
          example: { type: 'content', title: 'What is AI?', body: 'Artificial intelligence is the simulation of human intelligence by computer systems. It encompasses machine learning, natural language processing, and computer vision, enabling machines to learn from experience and perform human-like tasks.' },
        },
        'two-column': {
          description: 'Side-by-side content (MUST include leftContent and rightContent text)',
          required: ['title', 'leftContent', 'rightContent'],
          optional: ['leftTitle', 'rightTitle', 'leftIcon', 'rightIcon', 'speakerNotes'],
          example: { type: 'two-column', title: 'Pros and Cons', leftTitle: 'Advantages', leftContent: 'Increased efficiency, reduced costs, and improved accuracy in data processing.', rightTitle: 'Challenges', rightContent: 'Implementation complexity, data quality requirements, and ongoing maintenance needs.' },
        },
        'three-column': {
          description: 'Triple column layout (MUST include columns array with content)',
          required: ['title', 'columns'],
          optional: ['speakerNotes'],
          columns_schema: '{ title?: string, content: string, icon?: IconRef }',
          example: { type: 'three-column', title: 'Our Process', columns: [{ title: 'Plan', content: 'Define goals and strategy' }, { title: 'Execute', content: 'Implement the solution' }, { title: 'Review', content: 'Measure and optimize' }] },
        },
        'bullet-list': {
          description: 'Key points with bullets (MUST include items array)',
          required: ['title', 'items'],
          optional: ['speakerNotes'],
          items_schema: '{ text: string, subItems?: string[], icon?: IconRef }',
          example: { type: 'bullet-list', title: 'Key Benefits', items: [{ text: 'Saves time and resources' }, { text: 'Improves accuracy and consistency' }, { text: 'Scales to handle growth' }, { text: 'Easy to integrate with existing systems' }] },
        },
        'chart-bar': {
          description: 'Bar/column chart with optional commentary',
          required: ['title', 'series'],
          optional: ['commentary', 'horizontal', 'stacked', 'speakerNotes'],
          series_schema: '{ name: string, labels: string[], values: number[] }',
          example: { type: 'chart-bar', title: 'Revenue by Quarter', series: [{ name: 'Revenue', labels: ['Q1', 'Q2', 'Q3', 'Q4'], values: [120, 150, 180, 210] }] },
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
          example: { type: 'comparison', title: 'Before vs After', leftTitle: 'Before', leftItems: ['Manual processes', 'Slow turnaround', 'High error rate'], rightTitle: 'After', rightItems: ['Automated workflows', 'Instant results', 'Near-zero errors'] },
        },
        'stat-callout': {
          description: 'Big number emphasis with stat cards (MUST include stats array)',
          required: ['stats'],
          optional: ['title', 'speakerNotes'],
          stats_schema: '{ value: string, label: string, icon?: IconRef }',
          example: { type: 'stat-callout', title: 'By the Numbers', stats: [{ value: '98%', label: 'Customer Satisfaction' }, { value: '2.5x', label: 'Productivity Gain' }, { value: '50K+', label: 'Users Worldwide' }] },
        },
        timeline: {
          description: 'Process flow with connected steps (MUST include steps array)',
          required: ['title', 'steps'],
          optional: ['speakerNotes'],
          steps_schema: '{ title: string, description?: string, icon?: IconRef }',
          example: { type: 'timeline', title: 'Project Roadmap', steps: [{ title: 'Research', description: 'Gather requirements' }, { title: 'Design', description: 'Create prototypes' }, { title: 'Build', description: 'Develop solution' }, { title: 'Launch', description: 'Deploy to production' }] },
        },
        'image-text': {
          description: 'Half-bleed image with text. MUST include body text AND aiImage with a prompt for AI image generation.',
          required: ['title', 'body'],
          optional: ['imagePosition', 'speakerNotes', 'aiImage'],
          aiImage_schema: '{ prompt: string }',
          example: { type: 'image-text', title: 'Our Vision', body: 'We envision a world where technology empowers everyone to achieve more. Our mission drives innovation that makes a real difference.', aiImage: { prompt: 'Futuristic city skyline at sunset, clean modern architecture, inspirational' } },
        },
        'icon-grid': {
          description: '2x2 or 2x3 grid with icons and descriptions',
          required: ['title', 'items'],
          optional: ['speakerNotes'],
          items_schema: '{ title: string, description?: string, icon: IconRef }',
          example: { type: 'icon-grid', title: 'Key Features', items: [{ title: 'Speed', description: 'Lightning fast processing', icon: { name: 'bolt' } }, { title: 'Security', description: 'Enterprise-grade protection', icon: { name: 'shield' } }, { title: 'Scale', description: 'Grows with your needs', icon: { name: 'chart-line' } }, { title: 'Support', description: '24/7 expert assistance', icon: { name: 'headset' } }] },
        },
        quote: {
          description: 'Quote/testimonial with attribution (MUST include quote text)',
          required: ['quote'],
          optional: ['attribution', 'role', 'speakerNotes'],
          example: { type: 'quote', quote: 'Innovation distinguishes between a leader and a follower.', attribution: 'Steve Jobs', role: 'Co-founder, Apple' },
        },
        table: {
          description: 'Data table with alternating row colors',
          required: ['title', 'headers', 'rows'],
          optional: ['columnWidths', 'speakerNotes'],
        },
        team: {
          description: 'Team member profiles',
          required: ['title', 'members'],
          optional: ['speakerNotes'],
          members_schema: '{ name: string, role: string, description?: string }',
        },
        closing: {
          description: 'Thank you / contact slide',
          required: [],
          optional: ['title', 'subtitle', 'contactInfo', 'speakerNotes'],
          example: { type: 'closing', title: 'Thank You', subtitle: 'Questions? Reach out anytime.' },
        },
        agenda: {
          description: 'Table of contents (MUST include items array with topic titles)',
          required: ['items'],
          optional: ['title', 'speakerNotes'],
          items_schema: '{ title: string, description?: string, duration?: string }',
          example: { type: 'agenda', title: 'Agenda', items: [{ title: 'Introduction' }, { title: 'Key Concepts' }, { title: 'Demo' }, { title: 'Q&A' }] },
        },
        'full-image': {
          description: 'Full-bleed hero image. MUST include aiImage with a prompt for AI image generation.',
          required: [],
          optional: ['title', 'subtitle', 'image', 'aiImage', 'overlayPosition', 'scrim', 'speakerNotes'],
          aiImage_schema: '{ prompt: string }',
          example: { type: 'full-image', title: 'Explore the Possibilities', subtitle: 'Where innovation meets imagination', aiImage: { prompt: 'Breathtaking mountain landscape at golden hour, dramatic clouds, ultra wide angle' } },
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
