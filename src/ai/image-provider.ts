/**
 * AI Image Provider Abstraction
 * 
 * Supports multiple image generation backends:
 *  - OpenAI (DALL-E 3, GPT-image-1)
 *  - Azure OpenAI (DALL-E 3)
 *  - Custom HTTP endpoints (any compatible API)
 * 
 * All providers implement the same interface and return base64 PNG data.
 */

import { logger } from '../utils/logger.js';
import { DefaultAzureCredential, type TokenCredential } from '@azure/identity';

// ============================================================
// Types
// ============================================================

export type ImageSize = '1024x1024' | '1792x1024' | '1024x1792' | '512x512' | '256x256';
export type ImageStyle = 'natural' | 'vivid';
export type ImageQuality = 'standard' | 'high' | 'hd' | 'low' | 'medium' | 'auto';

export interface ImageGenerationRequest {
  /** The text prompt describing the desired image */
  prompt: string;
  /** Size of the generated image */
  size?: ImageSize;
  /** Style: natural (photorealistic) or vivid (hyper-real/dramatic) */
  style?: ImageStyle;
  /** Quality tier */
  quality?: ImageQuality;
  /** Number of images to generate (default: 1) */
  n?: number;
  /** Optional: presentation context for better prompt refinement */
  context?: {
    slideTitle?: string;
    slideType?: string;
    presentationTitle?: string;
    palette?: { primary: string; secondary: string; accent: string };
  };
}

export interface GeneratedImage {
  /** Base64-encoded image data (PNG) */
  base64: string;
  /** The prompt that was used (may be refined from original) */
  revisedPrompt?: string;
  /** Image dimensions */
  width: number;
  height: number;
  /** Provider that generated the image */
  provider: string;
  /** Generation time in ms */
  generationTimeMs: number;
}

export interface ImageProviderConfig {
  provider: 'openai' | 'azure-openai' | 'custom';
  /** API key for authentication */
  apiKey?: string;
  /** Model to use (e.g., 'dall-e-3', 'gpt-image-1') */
  model?: string;
  /** Base URL for API calls */
  baseUrl?: string;
  /** Azure-specific: deployment name */
  deploymentName?: string;
  /** Azure-specific: API version */
  apiVersion?: string;
  /** Default image size */
  defaultSize?: ImageSize;
  /** Default quality */
  defaultQuality?: ImageQuality;
  /** Default style */
  defaultStyle?: ImageStyle;
  /** Request timeout in ms (default: 60000) */
  timeoutMs?: number;
  /** Maximum concurrent image generations */
  maxConcurrent?: number;
}

// ============================================================
// Abstract Provider
// ============================================================

export interface IImageProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  generate(request: ImageGenerationRequest): Promise<GeneratedImage>;
  generateBatch(requests: ImageGenerationRequest[]): Promise<GeneratedImage[]>;
}

// ============================================================
// OpenAI Provider (DALL-E 3 / GPT-image-1)
// ============================================================

export class OpenAIImageProvider implements IImageProvider {
  readonly name: string;
  private config: ImageProviderConfig;

  constructor(config: Partial<ImageProviderConfig> = {}) {
    this.config = {
      provider: 'openai',
      apiKey: config.apiKey || process.env.OPENAI_API_KEY || '',
      model: config.model || process.env.AI_IMAGE_MODEL || 'gpt-image-1',
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
      defaultSize: config.defaultSize || '1792x1024',
      defaultQuality: config.defaultQuality || 'auto',
      defaultStyle: config.defaultStyle || 'natural',
      timeoutMs: config.timeoutMs || 120000,
      maxConcurrent: config.maxConcurrent || 3,
    };
    this.name = `openai/${this.config.model}`;
  }

  get isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  async generate(request: ImageGenerationRequest): Promise<GeneratedImage> {
    if (!this.isConfigured) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY environment variable.');
    }

    const start = Date.now();
    const model = this.config.model!;
    const size = request.size || this.config.defaultSize!;
    const [w, h] = size.split('x').map(Number);

    // Build request body — shape differs between DALL-E 3 and GPT-image-1
    const isGptImage = model.startsWith('gpt-image');
    const body: Record<string, unknown> = {
      model,
      prompt: request.prompt,
      n: request.n || 1,
      size,
    };

    if (isGptImage) {
      // GPT-image-1 uses quality and output_format
      body.quality = request.quality || this.config.defaultQuality;
      body.output_format = 'png';
    } else {
      // DALL-E 3 uses style and quality
      body.style = request.style || this.config.defaultStyle;
      body.quality = request.quality === 'high' ? 'hd' : (request.quality || 'standard');
      body.response_format = 'b64_json';
    }

    logger.info(`[${this.name}] Generating image: "${request.prompt.substring(0, 80)}..." (${size})`);

    const response = await fetch(`${this.config.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs!),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json() as any;
    const imageData = data.data?.[0];

    if (!imageData) {
      throw new Error('No image data in OpenAI response');
    }

    // Extract base64 — GPT-image-1 returns b64_json directly, DALL-E 3 too when response_format=b64_json
    const base64 = imageData.b64_json;
    if (!base64) {
      throw new Error('No base64 data in OpenAI response. Check model and response_format.');
    }

    const elapsed = Date.now() - start;
    logger.info(`[${this.name}] Image generated in ${elapsed}ms`);

    return {
      base64: `image/png;base64,${base64}`,
      revisedPrompt: imageData.revised_prompt,
      width: w,
      height: h,
      provider: this.name,
      generationTimeMs: elapsed,
    };
  }

  async generateBatch(requests: ImageGenerationRequest[]): Promise<GeneratedImage[]> {
    const maxConcurrent = this.config.maxConcurrent || 3;
    const results: GeneratedImage[] = [];

    // Process in batches to respect concurrency limits
    for (let i = 0; i < requests.length; i += maxConcurrent) {
      const batch = requests.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(
        batch.map(req => this.generate(req).catch(err => {
          logger.error(`[${this.name}] Batch image generation failed: ${err}`);
          return null;
        }))
      );
      results.push(...batchResults.filter((r): r is GeneratedImage => r !== null));
    }

    return results;
  }
}

// ============================================================
// Azure OpenAI Provider
// ============================================================

export class AzureOpenAIImageProvider implements IImageProvider {
  readonly name: string;
  private config: ImageProviderConfig;
  private credential: TokenCredential | null = null;

  constructor(config: Partial<ImageProviderConfig> = {}) {
    this.config = {
      provider: 'azure-openai',
      apiKey: config.apiKey || process.env.AZURE_OPENAI_API_KEY || '',
      model: config.model || 'dall-e-3',
      baseUrl: config.baseUrl || process.env.AZURE_OPENAI_ENDPOINT || '',
      deploymentName: config.deploymentName || process.env.AZURE_OPENAI_DEPLOYMENT || 'dall-e-3',
      apiVersion: config.apiVersion || process.env.AZURE_OPENAI_API_VERSION || '2024-02-01',
      defaultSize: config.defaultSize || '1792x1024',
      defaultQuality: config.defaultQuality || 'standard',
      defaultStyle: config.defaultStyle || 'natural',
      timeoutMs: config.timeoutMs || 120000,
      maxConcurrent: config.maxConcurrent || 2,
    };
    this.name = `azure-openai/${this.config.deploymentName}`;

    // If no API key but endpoint is set, use DefaultAzureCredential (Entra ID)
    if (!this.config.apiKey && this.config.baseUrl) {
      try {
        this.credential = new DefaultAzureCredential();
        logger.info(`[${this.name}] Using DefaultAzureCredential (Entra ID) for Azure OpenAI auth`);
      } catch (err) {
        logger.warn(`[${this.name}] Failed to initialize DefaultAzureCredential: ${err}`);
      }
    }
  }

  get isConfigured(): boolean {
    return !!(this.config.baseUrl && (this.config.apiKey || this.credential));
  }

  /**
   * Get auth headers — uses API key if available, otherwise gets an Entra ID token
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    if (this.config.apiKey) {
      return { 'api-key': this.config.apiKey };
    }
    if (this.credential) {
      const token = await this.credential.getToken('https://cognitiveservices.azure.com/.default');
      if (token) {
        return { 'Authorization': `Bearer ${token.token}` };
      }
    }
    throw new Error('No Azure OpenAI authentication available. Set AZURE_OPENAI_API_KEY or sign in with az login.');
  }

  async generate(request: ImageGenerationRequest): Promise<GeneratedImage> {
    if (!this.isConfigured) {
      throw new Error(
        'Azure OpenAI not configured. Set AZURE_OPENAI_ENDPOINT and either AZURE_OPENAI_API_KEY or sign in with az login for Entra ID auth.'
      );
    }

    const start = Date.now();
    const size = request.size || this.config.defaultSize!;
    const [w, h] = size.split('x').map(Number);
    const endpoint = this.config.baseUrl!.replace(/\/$/, '');
    const url = `${endpoint}/openai/deployments/${this.config.deploymentName}/images/generations?api-version=${this.config.apiVersion}`;

    const body = {
      prompt: request.prompt,
      n: 1,
      size,
      style: request.style || this.config.defaultStyle,
      quality: (() => {
        // Azure DALL-E 3 only supports 'hd' and 'standard'
        const q = request.quality || 'standard';
        if (q === 'high' || q === 'hd') return 'hd';
        return 'standard'; // map auto, low, medium → standard
      })(),
      response_format: 'b64_json',
    };

    logger.info(`[${this.name}] Generating image: "${request.prompt.substring(0, 80)}..." (${size})`);

    const authHeaders = await this.getAuthHeaders();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs!),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Azure OpenAI API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json() as any;
    const imageData = data.data?.[0];
    if (!imageData?.b64_json) {
      throw new Error('No base64 data in Azure OpenAI response');
    }

    const elapsed = Date.now() - start;
    logger.info(`[${this.name}] Image generated in ${elapsed}ms`);

    return {
      base64: `image/png;base64,${imageData.b64_json}`,
      revisedPrompt: imageData.revised_prompt,
      width: w,
      height: h,
      provider: this.name,
      generationTimeMs: elapsed,
    };
  }

  async generateBatch(requests: ImageGenerationRequest[]): Promise<GeneratedImage[]> {
    const maxConcurrent = this.config.maxConcurrent || 2;
    const results: GeneratedImage[] = [];

    for (let i = 0; i < requests.length; i += maxConcurrent) {
      const batch = requests.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(
        batch.map(req => this.generate(req).catch(err => {
          logger.error(`[${this.name}] Batch image generation failed: ${err}`);
          return null;
        }))
      );
      results.push(...batchResults.filter((r): r is GeneratedImage => r !== null));
    }

    return results;
  }
}

// ============================================================
// Image Generation Manager
// ============================================================

/**
 * Central manager for AI image generation.
 * Resolves the configured provider and handles caching.
 */
export class ImageGenerationManager {
  private provider: IImageProvider | null = null;
  private cache = new Map<string, GeneratedImage>();
  private providers = new Map<string, IImageProvider>();

  constructor() {
    // Auto-register providers based on available env vars
    const openai = new OpenAIImageProvider();
    if (openai.isConfigured) {
      this.providers.set('openai', openai);
    }

    const azure = new AzureOpenAIImageProvider();
    if (azure.isConfigured) {
      this.providers.set('azure-openai', azure);
    }

    // Set default provider — prefer explicit choice, then first available
    const preferredProvider = process.env.AI_IMAGE_PROVIDER || (azure.isConfigured ? 'azure-openai' : 'openai');
    this.provider = this.providers.get(preferredProvider) || this.providers.values().next().value || null;

    if (this.provider) {
      logger.info(`AI image provider configured: ${this.provider.name}`);
    } else {
      logger.info('No AI image provider configured. Set OPENAI_API_KEY or AZURE_OPENAI_API_KEY to enable image generation.');
    }
  }

  /** Whether image generation is available */
  get isAvailable(): boolean {
    return this.provider !== null && this.provider.isConfigured;
  }

  /** Get the active provider name */
  get activeProvider(): string | null {
    return this.provider?.name || null;
  }

  /** List all registered providers */
  listProviders(): string[] {
    return Array.from(this.providers.entries()).map(([key, p]) => `${key} (${p.isConfigured ? 'configured' : 'not configured'})`);
  }

  /** Set the active provider by key */
  setProvider(key: string): void {
    const provider = this.providers.get(key);
    if (!provider) {
      throw new Error(`Unknown provider: ${key}. Available: ${Array.from(this.providers.keys()).join(', ')}`);
    }
    this.provider = provider;
    logger.info(`Switched image provider to: ${provider.name}`);
  }

  /** Register a custom provider */
  registerProvider(key: string, provider: IImageProvider): void {
    this.providers.set(key, provider);
    if (!this.provider) {
      this.provider = provider;
    }
  }

  /**
   * Generate a single image.
   * Results are cached by prompt + size to avoid regeneration.
   */
  async generate(request: ImageGenerationRequest): Promise<GeneratedImage> {
    if (!this.provider) {
      throw new Error('No AI image provider configured. Set OPENAI_API_KEY or AZURE_OPENAI_API_KEY.');
    }

    // Check cache
    const cacheKey = this.getCacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      logger.info('Returning cached image');
      return cached;
    }

    const result = await this.provider.generate(request);
    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Generate multiple images concurrently.
   */
  async generateBatch(requests: ImageGenerationRequest[]): Promise<GeneratedImage[]> {
    if (!this.provider) {
      throw new Error('No AI image provider configured.');
    }

    // Split into cached and uncached
    const results: (GeneratedImage | null)[] = new Array(requests.length).fill(null);
    const uncachedIndices: number[] = [];

    for (let i = 0; i < requests.length; i++) {
      const cacheKey = this.getCacheKey(requests[i]);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        results[i] = cached;
      } else {
        uncachedIndices.push(i);
      }
    }

    if (uncachedIndices.length > 0) {
      const uncachedRequests = uncachedIndices.map(i => requests[i]);
      const generated = await this.provider.generateBatch(uncachedRequests);

      for (let j = 0; j < generated.length && j < uncachedIndices.length; j++) {
        const idx = uncachedIndices[j];
        results[idx] = generated[j];
        this.cache.set(this.getCacheKey(requests[idx]), generated[j]);
      }
    }

    return results.filter((r): r is GeneratedImage => r !== null);
  }

  /** Clear the in-memory image cache */
  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`Cleared image cache (${size} entries)`);
  }

  private getCacheKey(request: ImageGenerationRequest): string {
    return `${request.prompt}|${request.size || 'default'}|${request.quality || 'default'}|${request.style || 'default'}`;
  }
}

// Export lazy singleton — deferred so dotenv.config() can run first
let _imageManager: ImageGenerationManager | null = null;
export function getImageManager(): ImageGenerationManager {
  if (!_imageManager) {
    _imageManager = new ImageGenerationManager();
  }
  return _imageManager;
}

/** @deprecated Use getImageManager() instead — kept for backward compatibility */
export const imageManager = new Proxy({} as ImageGenerationManager, {
  get(_target, prop) {
    return (getImageManager() as any)[prop];
  },
});
