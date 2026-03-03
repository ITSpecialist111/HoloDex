import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { pptxEngine } from './engine/pptx-engine.js';
import { brandManager, BrandManager } from './engine/brand-manager.js';
import { listPresetPalettes } from './engine/theme-resolver.js';
import { PresentationRequestSchema, PRESET_PALETTES } from './schemas.js';
import type { PresentationRequest, PresentationResult, BrandConfig, Slide } from './schemas.js';
import { imageManager } from './ai/image-provider.js';
import { logger } from './utils/logger.js';
import { fileStore } from './utils/file-store.js';

const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

export function createApiRouter(): express.Router {
  const router = express.Router();

  // ================================================================
  // Health & Info
  // ================================================================

  router.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'holodex',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/info', (_req, res) => {
    res.json({
      service: 'HoloDex Engine',
      version: '1.1.0',
      description: 'AI-powered PowerPoint generation with rich formatting, charts, icons, AI image generation, and brand support',
      capabilities: {
        slideTypes: [
          'title', 'section', 'content', 'two-column', 'three-column',
          'bullet-list', 'chart-bar', 'chart-line', 'chart-pie', 'chart-doughnut',
          'comparison', 'stat-callout', 'timeline', 'image-text', 'icon-grid',
          'quote', 'table', 'team', 'closing', 'agenda', 'blank', 'full-image',
        ],
        maxSlides: 50,
        outputFormats: ['buffer', 'base64', 'file'],
        presetPalettes: listPresetPalettes(),
        brandSupport: true,
        speakerNotes: true,
        chartTypes: ['bar', 'line', 'pie', 'doughnut'],
        iconLibraries: ['fa (Font Awesome)', 'md (Material Design)', 'hi (Heroicons)', 'bi (Bootstrap)'],
        aiImageGeneration: {
          available: imageManager.isAvailable,
          activeProvider: imageManager.activeProvider,
          providers: imageManager.listProviders(),
          supportedSizes: ['1024x1024', '1792x1024', '1024x1792', '512x512', '256x256'],
          supportedStyles: ['natural', 'vivid'],
          supportedPlacements: ['background', 'inline', 'left', 'right', 'full'],
        },
      },
    });
  });

  // ================================================================
  // Presentation Generation
  // ================================================================

  router.post('/presentations', async (req, res) => {
    const requestId = uuidv4();
    logger.info(`[${requestId}] Presentation generation request received`);

    try {
      const body = req.body;

      // Resolve brand if specified by name
      if (body.brandName && !body.brand) {
        const brand = await brandManager.getBrand(body.brandName);
        if (brand) {
          body.brand = brand;
        } else {
          res.status(400).json({
            error: `Brand "${body.brandName}" not found`,
            availableBrands: await brandManager.listBrands(),
          });
          return;
        }
      }

      // Default output format to base64 for API
      if (!body.outputFormat) {
        body.outputFormat = 'base64';
      }

      const result = await pptxEngine.generate(body as PresentationRequest);

      if (!result.success) {
        res.status(422).json({
          requestId,
          error: 'Generation failed',
          errors: result.errors,
          warnings: result.warnings,
        });
        return;
      }

      // Return based on format — check blobUrl before buffer since blob-url returns both
      if (result.blobUrl) {
        res.json({
          requestId,
          success: true,
          fileName: result.fileName,
          slideCount: result.slideCount,
          blobUrl: result.blobUrl,
          warnings: result.warnings,
        });
      } else if (result.buffer) {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
        res.send(result.buffer);
      } else {
        res.json({
          requestId,
          success: true,
          fileName: result.fileName,
          slideCount: result.slideCount,
          base64: result.base64,
          filePath: result.filePath,
          warnings: result.warnings,
        });
      }
    } catch (error) {
      logger.error(`[${requestId}] Error`, error);
      res.status(500).json({
        requestId,
        error: 'Internal server error',
        message: String(error),
      });
    }
  });

  // Download endpoint (returns file directly)
  router.post('/presentations/download', async (req, res) => {
    try {
      const body = { ...req.body, outputFormat: 'buffer' };

      if (body.brandName && !body.brand) {
        const brand = await brandManager.getBrand(body.brandName);
        if (brand) body.brand = brand;
      }

      const result = await pptxEngine.generate(body as PresentationRequest);

      if (!result.success || !result.buffer) {
        res.status(422).json({ error: 'Generation failed', errors: result.errors });
        return;
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.send(result.buffer);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Quick presentation from outline
  router.post('/presentations/quick', async (req, res) => {
    try {
      const { title, outline, paletteName, brandName } = req.body;

      if (!title || !outline || !Array.isArray(outline)) {
        res.status(400).json({ error: 'title and outline (array) are required' });
        return;
      }

      const palette = paletteName ? PRESET_PALETTES[paletteName] : PRESET_PALETTES['teal-trust'];
      if (paletteName && !palette) {
        res.status(400).json({
          error: `Unknown palette: ${paletteName}`,
          available: listPresetPalettes(),
        });
        return;
      }

      let brand: BrandConfig | undefined;
      if (brandName) {
        brand = (await brandManager.getBrand(brandName)) || undefined;
      }

      const slides: Slide[] = outline.map((item: any, i: number) => {
        if (i === 0 || item.type === 'title') {
          return { type: 'title' as const, title: item.title, subtitle: item.body, speakerNotes: item.speakerNotes };
        }
        if (item.type === 'closing') {
          return { type: 'closing' as const, title: item.title, subtitle: item.body, speakerNotes: item.speakerNotes };
        }
        if (item.type === 'section') {
          return { type: 'section' as const, title: item.title, subtitle: item.body, speakerNotes: item.speakerNotes };
        }
        return { type: 'content' as const, title: item.title, body: item.body || '', speakerNotes: item.speakerNotes };
      });

      const result = await pptxEngine.generate(PresentationRequestSchema.parse({
        title,
        slides,
        theme: palette ? { palette } : undefined,
        brand,
        outputFormat: 'base64',
      }));

      res.json({
        success: result.success,
        fileName: result.fileName,
        slideCount: result.slideCount,
        base64: result.base64,
        warnings: result.warnings,
        errors: result.errors,
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // ================================================================
  // File Downloads (for Copilot Studio / external clients)
  // ================================================================

  router.get('/downloads/:id', (req, res) => {
    const file = fileStore.get(req.params.id);
    if (!file) {
      res.status(404).json({ error: 'File not found or expired' });
      return;
    }
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.setHeader('Content-Length', file.buffer.length);
    res.send(file.buffer);
  });

  // ================================================================
  // Brand Management
  // ================================================================

  router.post('/brands', async (req, res) => {
    try {
      const { name, ...params } = req.body;
      if (!name || !params.companyName || !params.primaryColor || !params.secondaryColor) {
        res.status(400).json({
          error: 'Required fields: name, companyName, primaryColor, secondaryColor',
        });
        return;
      }

      const config = BrandManager.createBrandConfig(params);
      await brandManager.registerBrand(name, config);

      res.json({ success: true, message: `Brand "${name}" registered` });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  router.get('/brands', async (_req, res) => {
    const brands = await brandManager.listBrands();
    res.json({ brands });
  });

  router.get('/brands/:name', async (req, res) => {
    const brand = await brandManager.getBrand(req.params.name);
    if (!brand) {
      res.status(404).json({ error: `Brand "${req.params.name}" not found` });
      return;
    }
    // Don't expose full logo base64 in GET
    const safe = { ...brand };
    if (safe.logoBase64) safe.logoBase64 = '[base64 data]';
    if (safe.masterTemplateBase64) safe.masterTemplateBase64 = '[base64 data]';
    res.json(safe);
  });

  router.delete('/brands/:name', async (req, res) => {
    const deleted = await brandManager.deleteBrand(req.params.name);
    res.json({ success: deleted });
  });

  // Brand with logo upload
  router.post('/brands/upload', upload.single('logo'), async (req, res) => {
    try {
      const { name, companyName, primaryColor, secondaryColor, ...rest } = req.body;

      let logoBase64: string | undefined;
      if (req.file) {
        const mimeType = req.file.mimetype;
        logoBase64 = `${mimeType};base64,${req.file.buffer.toString('base64')}`;
      }

      const config = BrandManager.createBrandConfig({
        companyName,
        primaryColor,
        secondaryColor,
        logoBase64,
        ...rest,
      });

      await brandManager.registerBrand(name, config);
      res.json({ success: true, message: `Brand "${name}" registered with logo` });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // ================================================================
  // AI Image Generation
  // ================================================================

  router.post('/images/generate', async (req, res) => {
    const requestId = uuidv4();
    logger.info(`[${requestId}] Image generation request received`);

    try {
      const { prompt, size, style, quality, n } = req.body;
      if (!prompt) {
        res.status(400).json({ error: 'prompt is required' });
        return;
      }

      if (!imageManager.isAvailable) {
        res.status(503).json({
          error: 'AI image generation not configured',
          message: 'Set OPENAI_API_KEY or AZURE_OPENAI_API_KEY environment variable',
        });
        return;
      }

      const result = await imageManager.generate({ prompt, size, style, quality, n });

      res.json({
        requestId,
        success: true,
        image: {
          base64: result.base64,
          revisedPrompt: result.revisedPrompt,
          width: result.width,
          height: result.height,
          provider: result.provider,
          generationTimeMs: result.generationTimeMs,
        },
      });
    } catch (error) {
      logger.error(`[${requestId}] Image generation error`, error);
      res.status(500).json({
        requestId,
        error: 'Image generation failed',
        message: String(error),
      });
    }
  });

  router.get('/images/status', (_req, res) => {
    res.json({
      available: imageManager.isAvailable,
      activeProvider: imageManager.activeProvider,
      providers: imageManager.listProviders(),
    });
  });

  // ================================================================
  // Palettes & Design
  // ================================================================

  router.get('/palettes', (_req, res) => {
    const palettes = Object.entries(PRESET_PALETTES).map(([name, palette]) => ({
      name,
      ...palette,
    }));
    res.json({ palettes });
  });

  router.get('/slide-types', (_req, res) => {
    res.json({
      slideTypes: [
        { type: 'title', description: 'Opening title slide', required: ['title'] },
        { type: 'section', description: 'Section divider', required: ['title'] },
        { type: 'content', description: 'Text content', required: ['title', 'body'] },
        { type: 'two-column', description: 'Side-by-side', required: ['title', 'leftContent', 'rightContent'] },
        { type: 'three-column', description: 'Triple columns', required: ['title', 'columns'] },
        { type: 'bullet-list', description: 'Bullet points', required: ['title', 'items'] },
        { type: 'chart-bar', description: 'Bar chart', required: ['title', 'series'] },
        { type: 'chart-line', description: 'Line chart', required: ['title', 'series'] },
        { type: 'chart-pie', description: 'Pie chart', required: ['title', 'series'] },
        { type: 'chart-doughnut', description: 'Doughnut chart', required: ['title', 'series'] },
        { type: 'comparison', description: 'Compare two options', required: ['title', 'leftTitle', 'leftItems', 'rightTitle', 'rightItems'] },
        { type: 'stat-callout', description: 'Big numbers', required: ['stats'] },
        { type: 'timeline', description: 'Process steps', required: ['title', 'steps'] },
        { type: 'image-text', description: 'Half-image layout', required: ['title', 'body', 'image'] },
        { type: 'icon-grid', description: 'Icon feature grid', required: ['title', 'items'] },
        { type: 'quote', description: 'Quote/testimonial', required: ['quote'] },
        { type: 'table', description: 'Data table', required: ['title', 'headers', 'rows'] },
        { type: 'team', description: 'Team profiles', required: ['title', 'members'] },
        { type: 'closing', description: 'Thank you slide', required: [] },
        { type: 'agenda', description: 'Agenda/TOC', required: ['items'] },
        { type: 'full-image', description: 'Full-bleed hero image with optional text overlay (AI or static)', required: [], optional: ['title', 'subtitle', 'image', 'aiImage', 'overlayPosition', 'scrim'] },
      ],
    });
  });

  return router;
}

/**
 * Create and configure the Express application
 */
export function createApp(): express.Application {
  const app = express();

  // Middleware
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(morgan('combined'));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API routes
  app.use('/api/v1', createApiRouter());

  // Start file store cleanup timer
  fileStore.startCleanup();

  // Root redirect
  app.get('/', (_req, res) => {
    res.json({
      service: 'HoloDex Engine',
      docs: '/api/v1/info',
      health: '/api/v1/health',
    });
  });

  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error', err);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  });

  return app;
}
