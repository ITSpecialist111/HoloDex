import PptxGenJS from 'pptxgenjs';
import type {
  PresentationRequest,
  PresentationResult,
  SlideRenderContext,
  DesignTheme,
  BrandConfig,
  Slide,
} from '../schemas.js';
import { PresentationRequestSchema } from '../schemas.js';
import { resolveTheme } from './theme-resolver.js';
import { SLIDE_RENDERERS } from './slide-renderers.js';
import { logger } from '../utils/logger.js';
import { clearIconCache } from '../utils/icon-renderer.js';
import { imageManager } from '../ai/image-provider.js';
import { generateBatchPrompts } from '../ai/prompt-generator.js';
import { fileStore } from '../utils/file-store.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Core PPTX generation engine.
 * Takes a structured PresentationRequest and produces a complete .pptx file.
 */
export class PptxEngine {
  /**
   * Generate a complete PowerPoint presentation from a structured request.
   */
  async generate(request: PresentationRequest): Promise<PresentationResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Validate request
      const validated = PresentationRequestSchema.parse(request);
      logger.info(`Generating presentation: "${validated.title}" with ${validated.slides.length} slides`);

      // Resolve theme (merging defaults, brand, and explicit theme)
      const theme = resolveTheme(validated.theme, validated.brand, validated.paletteName);
      logger.info(`Using theme with palette primary: ${theme.palette.primary}`);

      // Create PptxGenJS instance
      const pres = new PptxGenJS();
      pres.layout = theme.slideLayout as any;
      pres.author = validated.author || 'HoloDex Engine';
      pres.title = validated.title;

      // Define slide masters if brand provided
      if (validated.brand) {
        this.defineBrandMasters(pres, theme, validated.brand);
      }

      // -------------------------------------------------------
      // AI Image Pre-Generation
      // -------------------------------------------------------
      const aiImages = new Map<number, { base64: string; revisedPrompt?: string }>();

      // Auto-detect AI slides — no need for aiImageSettings.enabled flag
      const hasAiSlides = validated.slides.some((slide: any) => slide.aiImage);
      const aiEnabled = validated.aiImageSettings?.enabled || hasAiSlides;

      if ((aiEnabled || hasAiSlides) && imageManager.isAvailable) {
        try {
          const promptBatches = generateBatchPrompts(validated.slides, theme, validated.title);

          if (promptBatches.length > 0) {
            logger.info(`Generating ${promptBatches.length} AI images...`);
            const requests = promptBatches.map(b => b.request);
            const generated = await imageManager.generateBatch(requests);

            for (let j = 0; j < generated.length && j < promptBatches.length; j++) {
              const img = generated[j];
              const slideIdx = promptBatches[j].slideIndex;
              aiImages.set(slideIdx, {
                base64: img.base64,
                revisedPrompt: img.revisedPrompt,
              });
              logger.info(`AI image generated for slide ${slideIdx + 1} (${img.generationTimeMs}ms)`);
            }
          }
        } catch (err) {
          const msg = `AI image generation failed: ${err}`;
          warnings.push(msg);
          logger.error(msg, err);
        }
      } else if (hasAiSlides && !imageManager.isAvailable) {
        const errMsg = 'AI image generation requested but no provider configured. Set OPENAI_API_KEY or AZURE_OPENAI_API_KEY environment variable.';
        warnings.push(errMsg);
        logger.warn(errMsg);
      }

      // Render each slide
      const ctx: SlideRenderContext = {
        pres,
        theme,
        brand: validated.brand,
        slideIndex: 0,
        totalSlides: validated.slides.length,
        iconCache: new Map(),
        aiImages,
      };

      for (let i = 0; i < validated.slides.length; i++) {
        const slide = validated.slides[i];
        ctx.slideIndex = i;

        const renderer = SLIDE_RENDERERS[slide.type];
        if (!renderer) {
          warnings.push(`Unknown slide type: ${slide.type} at index ${i}`);
          logger.warn(`No renderer for slide type: ${slide.type}`);
          continue;
        }

        try {
          await renderer(slide, ctx);
          logger.info(`Rendered slide ${i + 1}/${validated.slides.length}: ${slide.type}`);
        } catch (err) {
          const msg = `Error rendering slide ${i + 1} (${slide.type}): ${err}`;
          warnings.push(msg);
          logger.error(msg, err);
        }
      }

      // Generate output
      const fileName = validated.outputFileName || `${this.sanitizeFileName(validated.title)}.pptx`;
      const result = await this.writeOutput(pres, validated.outputFormat, fileName);

      const elapsed = Date.now() - startTime;
      logger.info(`Presentation generated in ${elapsed}ms: ${fileName}`);

      // Clear icon cache after generation
      clearIconCache();

      return {
        success: true,
        fileName,
        slideCount: validated.slides.length,
        warnings: warnings.length > 0 ? warnings : undefined,
        ...result,
      };
    } catch (error) {
      logger.error('Presentation generation failed', error);
      return {
        success: false,
        fileName: '',
        slideCount: 0,
        errors: [String(error)],
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }
  }

  /**
   * Generate a single slide as a standalone presentation (useful for previews).
   */
  async generateSingleSlide(
    slide: Slide,
    theme?: Partial<DesignTheme>,
    brand?: BrandConfig,
  ): Promise<PresentationResult> {
    return this.generate({
      title: 'Single Slide Preview',
      slides: [slide],
      theme: theme as any,
      brand,
      outputFormat: 'buffer',
    });
  }

  /**
   * Define slide masters based on brand configuration
   */
  private defineBrandMasters(
    pres: PptxGenJS,
    theme: DesignTheme,
    brand: BrandConfig,
  ): void {
    const typo = theme.typography!;

    // Title Master
    pres.defineSlideMaster({
      title: 'BRAND_TITLE',
      background: { color: theme.palette.backgroundDark },
      objects: [
        // Top accent bar
        {
          rect: {
            x: 0, y: 0, w: 10, h: 0.06,
            fill: { color: theme.palette.accent },
          },
        },
        // Logo placeholder
        ...(brand.logoBase64 ? [{
          image: {
            data: brand.logoBase64,
            x: 0.6, y: 0.5, w: 1.2, h: 0.6,
            sizing: { type: 'contain' as const, w: 1.2, h: 0.6 },
          },
        }] : []),
        // Title placeholder
        {
          placeholder: {
            options: {
              name: 'title',
              type: 'title' as const,
              x: 0.6, y: 1.5, w: 8.8, h: 1.6,
              fontSize: typo.titleSize + 4,
              fontFace: typo.headerFont,
              color: theme.palette.textOnDark,
              bold: true,
            },
          },
        },
      ],
    });

    // Content Master
    pres.defineSlideMaster({
      title: 'BRAND_CONTENT',
      background: { color: theme.palette.background },
      objects: [
        // Footer bar
        {
          rect: {
            x: 0, y: 5.325, w: 10, h: 0.3,
            fill: { color: theme.palette.primary },
          },
        },
        // Company name in footer
        {
          text: {
            text: brand.companyName,
            options: {
              x: 0.5, y: 5.325, w: 4, h: 0.3,
              fontSize: 8,
              fontFace: typo.bodyFont,
              color: isDarkColorSimple(theme.palette.primary) ? 'FFFFFF' : '1E293B',
              valign: 'middle',
              margin: 0,
            },
          },
        },
        // Logo in corner
        ...(brand.logoBase64 ? [{
          image: {
            data: brand.logoBase64,
            x: 8.5, y: 5.35, w: 1.0, h: 0.25,
            sizing: { type: 'contain' as const, w: 1.0, h: 0.25 },
          },
        }] : []),
      ],
    });
  }

  /**
   * Write presentation output in the requested format
   */
  private async writeOutput(
    pres: PptxGenJS,
    format: string,
    fileName: string,
  ): Promise<Partial<PresentationResult>> {
    switch (format) {
      case 'base64': {
        const base64 = await pres.write({ outputType: 'base64' }) as string;
        return { base64 };
      }
      case 'file': {
        const outputDir = process.env.OUTPUT_DIR || './output';
        await fs.mkdir(outputDir, { recursive: true });
        const filePath = path.join(outputDir, fileName);
        await pres.writeFile({ fileName: filePath });
        return { filePath };
      }
      case 'blob-url': {
        const arrayBuffer2 = await pres.write({ outputType: 'arraybuffer' }) as ArrayBuffer;
        const buf = Buffer.from(arrayBuffer2);
        const baseUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
        const stored = fileStore.store(buf, fileName, 0);
        const blobUrl = fileStore.downloadUrl(stored.id, baseUrl);
        return { buffer: buf, blobUrl };
      }
      case 'buffer':
      default: {
        const arrayBuffer = await pres.write({ outputType: 'arraybuffer' }) as ArrayBuffer;
        const buffer = Buffer.from(arrayBuffer);
        return { buffer };
      }
    }
  }

  /**
   * Sanitize a string for use as a filename
   */
  private sanitizeFileName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 60);
  }
}

/**
 * Simple dark color check (avoiding circular imports)
 */
function isDarkColorSimple(hex: string): boolean {
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

// Export singleton instance
export const pptxEngine = new PptxEngine();
