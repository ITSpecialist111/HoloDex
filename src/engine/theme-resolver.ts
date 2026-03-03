import type { DesignTheme, ColorPalette, Typography, BrandConfig } from '../schemas.js';
import { PRESET_PALETTES } from '../schemas.js';

/**
 * Default typography settings
 */
export const DEFAULT_TYPOGRAPHY: Typography = {
  headerFont: 'Century Gothic',
  bodyFont: 'Calibri',
  titleSize: 40,
  subtitleSize: 22,
  headingSize: 24,
  bodySize: 14,
  captionSize: 11,
  quoteFont: 'Georgia',
};

/**
 * Default design theme
 */
export const DEFAULT_THEME: DesignTheme = {
  palette: PRESET_PALETTES['teal-trust'],
  typography: DEFAULT_TYPOGRAPHY,
  visualMotif: 'accent-borders',
  slideLayout: 'LAYOUT_16x9',
};

/**
 * Resolve a complete design theme from partial input, brand config, or defaults
 */
export function resolveTheme(
  themeInput?: Partial<DesignTheme>,
  brand?: BrandConfig,
  paletteName?: string,
): DesignTheme {
  // Start with defaults
  let theme: DesignTheme = { ...DEFAULT_THEME };

  // If paletteName is provided, resolve it first
  if (paletteName) {
    const preset = PRESET_PALETTES[paletteName];
    if (preset) {
      theme.palette = { ...preset };
    }
  }

  // If brand is provided, it takes priority for colors and fonts
  if (brand) {
    theme.palette = {
      ...DEFAULT_THEME.palette,
      ...brand.palette,
    };
    if (brand.typography) {
      theme.typography = {
        ...DEFAULT_TYPOGRAPHY,
        ...brand.typography,
      };
    }
    if (brand.visualMotif) {
      theme.visualMotif = brand.visualMotif;
    }
  }

  // Theme input overrides everything
  if (themeInput) {
    if (themeInput.palette) {
      theme.palette = {
        ...theme.palette,
        ...themeInput.palette,
      };
    }
    if (themeInput.typography) {
      theme.typography = {
        ...(theme.typography || DEFAULT_TYPOGRAPHY),
        ...themeInput.typography,
      };
    }
    if (themeInput.visualMotif) {
      theme.visualMotif = themeInput.visualMotif;
    }
    if (themeInput.slideLayout) {
      theme.slideLayout = themeInput.slideLayout;
    }
  }

  return theme;
}

/**
 * Get a palette by name, or return the input if it's already a palette
 */
export function getPalette(nameOrPalette: string | ColorPalette): ColorPalette {
  if (typeof nameOrPalette === 'string') {
    const preset = PRESET_PALETTES[nameOrPalette];
    if (!preset) {
      throw new Error(
        `Unknown palette: ${nameOrPalette}. Available: ${Object.keys(PRESET_PALETTES).join(', ')}`,
      );
    }
    return preset;
  }
  return nameOrPalette;
}

/**
 * Get chart colors derived from the theme palette
 */
export function getChartColors(palette: ColorPalette): string[] {
  const colors = [palette.primary, palette.secondary, palette.accent];

  // Generate additional colors by lightening/darkening
  if (palette.success) colors.push(palette.success);
  if (palette.warning) colors.push(palette.warning);
  if (palette.error) colors.push(palette.error);

  // Add tinted variants
  colors.push(lightenColor(palette.primary, 30));
  colors.push(lightenColor(palette.secondary, 20));

  return colors.filter(c => c !== 'FFFFFF' && c !== 'F2F2F2'); // remove near-white
}

/**
 * Lighten a hex color by a percentage
 */
export function lightenColor(hex: string, percent: number): string {
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const newR = Math.min(255, Math.round(r + (255 - r) * (percent / 100)));
  const newG = Math.min(255, Math.round(g + (255 - g) * (percent / 100)));
  const newB = Math.min(255, Math.round(b + (255 - b) * (percent / 100)));

  return (
    newR.toString(16).padStart(2, '0') +
    newG.toString(16).padStart(2, '0') +
    newB.toString(16).padStart(2, '0')
  ).toUpperCase();
}

/**
 * Darken a hex color by a percentage
 */
export function darkenColor(hex: string, percent: number): string {
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const newR = Math.max(0, Math.round(r * (1 - percent / 100)));
  const newG = Math.max(0, Math.round(g * (1 - percent / 100)));
  const newB = Math.max(0, Math.round(b * (1 - percent / 100)));

  return (
    newR.toString(16).padStart(2, '0') +
    newG.toString(16).padStart(2, '0') +
    newB.toString(16).padStart(2, '0')
  ).toUpperCase();
}

/**
 * Check if a color is considered "dark" (for determining text contrast)
 */
export function isDarkColor(hex: string): boolean {
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Using relative luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

/**
 * Get appropriate text color for a given background
 */
export function getContrastTextColor(
  bgHex: string,
  palette: ColorPalette,
): string {
  return isDarkColor(bgHex) ? palette.textOnDark : palette.text;
}

/**
 * Get the list of available preset palette names
 */
export function listPresetPalettes(): string[] {
  return Object.keys(PRESET_PALETTES);
}
