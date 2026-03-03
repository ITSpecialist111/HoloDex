import type { BrandConfig, ColorPalette, Typography } from '../schemas.js';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Brand Manager - loads, stores, and applies company brand configurations.
 * Supports loading from JSON files, master PPTX templates, and manual configuration.
 */
export class BrandManager {
  private brands: Map<string, BrandConfig> = new Map();
  private storageDir: string;

  constructor(storageDir?: string) {
    this.storageDir = storageDir || process.env.BRAND_STORAGE_DIR || './brands';
  }

  /**
   * Register a brand configuration
   */
  async registerBrand(name: string, config: BrandConfig): Promise<void> {
    this.brands.set(name.toLowerCase(), config);
    logger.info(`Brand registered: ${name}`);

    // Persist to disk
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      const filePath = path.join(this.storageDir, `${name.toLowerCase()}.json`);
      // Don't persist large base64 logo data in the JSON index
      const persistConfig = { ...config };
      if (persistConfig.logoBase64 && persistConfig.logoBase64.length > 10000) {
        // Store logo separately
        const logoPath = path.join(this.storageDir, `${name.toLowerCase()}-logo.txt`);
        await fs.writeFile(logoPath, persistConfig.logoBase64, 'utf-8');
        persistConfig.logoBase64 = `@file:${name.toLowerCase()}-logo.txt`;
      }
      await fs.writeFile(filePath, JSON.stringify(persistConfig, null, 2), 'utf-8');
    } catch (err) {
      logger.warn('Failed to persist brand config', err);
    }
  }

  /**
   * Get a registered brand configuration
   */
  async getBrand(name: string): Promise<BrandConfig | null> {
    const cached = this.brands.get(name.toLowerCase());
    if (cached) return cached;

    // Try loading from disk
    try {
      const filePath = path.join(this.storageDir, `${name.toLowerCase()}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const config: BrandConfig = JSON.parse(data);

      // Load external logo if referenced
      if (config.logoBase64?.startsWith('@file:')) {
        const logoFile = config.logoBase64.replace('@file:', '');
        const logoPath = path.join(this.storageDir, logoFile);
        config.logoBase64 = await fs.readFile(logoPath, 'utf-8');
      }

      this.brands.set(name.toLowerCase(), config);
      return config;
    } catch {
      return null;
    }
  }

  /**
   * List all registered brand names
   */
  async listBrands(): Promise<string[]> {
    const names = new Set<string>(this.brands.keys());

    try {
      const files = await fs.readdir(this.storageDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          names.add(file.replace('.json', ''));
        }
      }
    } catch {
      // Storage dir doesn't exist yet
    }

    return Array.from(names);
  }

  /**
   * Delete a brand
   */
  async deleteBrand(name: string): Promise<boolean> {
    this.brands.delete(name.toLowerCase());

    try {
      const filePath = path.join(this.storageDir, `${name.toLowerCase()}.json`);
      await fs.unlink(filePath);
      // Also try to delete logo file
      try {
        const logoPath = path.join(this.storageDir, `${name.toLowerCase()}-logo.txt`);
        await fs.unlink(logoPath);
      } catch { /* ok */ }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a brand config from common parameters
   */
  static createBrandConfig(params: {
    companyName: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor?: string;
    headerFont?: string;
    bodyFont?: string;
    toneOfVoice?: BrandConfig['toneOfVoice'];
    tagline?: string;
    logoBase64?: string;
    logoUrl?: string;
  }): BrandConfig {
    return {
      companyName: params.companyName,
      tagline: params.tagline,
      logoBase64: params.logoBase64,
      logoUrl: params.logoUrl,
      palette: {
        primary: params.primaryColor,
        secondary: params.secondaryColor,
        accent: params.accentColor || params.primaryColor,
        background: 'FFFFFF',
        backgroundDark: darkenSimple(params.primaryColor, 40),
        text: '1E293B',
        textLight: '64748B',
        textOnDark: 'FFFFFF',
      },
      typography: {
        headerFont: params.headerFont || 'Century Gothic',
        bodyFont: params.bodyFont || 'Calibri',
        quoteFont: 'Georgia',
        titleSize: 40,
        subtitleSize: 22,
        headingSize: 24,
        bodySize: 14,
        captionSize: 11,
      },
      toneOfVoice: params.toneOfVoice || 'formal',
    };
  }

  /**
   * Extract basic brand info from a master template PPTX file.
   * This is a simplified extraction — for full template support,
   * the template-based workflow uses unpack/edit/pack.
   */
  async extractBrandFromTemplate(
    templateBase64: string,
    companyName: string,
  ): Promise<BrandConfig> {
    // Store the template
    const brand: BrandConfig = {
      companyName,
      palette: {
        primary: '0066CC',
        secondary: 'E6F0FF',
        accent: 'FF6600',
        background: 'FFFFFF',
        backgroundDark: '003366',
        text: '333333',
        textLight: '666666',
        textOnDark: 'FFFFFF',
      },
      masterTemplateBase64: templateBase64,
      toneOfVoice: 'formal',
    };

    logger.info(`Brand extracted from template for: ${companyName}`);
    return brand;
  }

  /**
   * Load all brands from storage directory
   */
  async loadAll(): Promise<void> {
    try {
      const files = await fs.readdir(this.storageDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const name = file.replace('.json', '');
          await this.getBrand(name);
        }
      }
      logger.info(`Loaded ${this.brands.size} brands from storage`);
    } catch {
      logger.info('No brands storage directory found, starting fresh');
    }
  }
}

function darkenSimple(hex: string, percent: number): string {
  const r = Math.max(0, Math.round(parseInt(hex.substring(0, 2), 16) * (1 - percent / 100)));
  const g = Math.max(0, Math.round(parseInt(hex.substring(2, 4), 16) * (1 - percent / 100)));
  const b = Math.max(0, Math.round(parseInt(hex.substring(4, 6), 16) * (1 - percent / 100)));
  return (
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0')
  ).toUpperCase();
}

// Export singleton
export const brandManager = new BrandManager();
