/**
 * Layout constants — the spatial DNA of every slide.
 *
 * All values are in inches (PptxGenJS native unit) for a 16:9 (10×5.625) canvas.
 * Using named constants eliminates magic numbers and makes the grid
 * tuneable from a single file.
 */

// ============================================================
// Canvas
// ============================================================

/** Slide width in inches */
export const SLIDE_W = 10;
/** Slide height in inches */
export const SLIDE_H = 5.625;

// ============================================================
// Margins & Gutters
// ============================================================

/** Left / right content margin */
export const MARGIN_X = 0.7;
/** Top margin (above title) */
export const MARGIN_TOP = 0.35;
/** Content area width (SLIDE_W − 2 × MARGIN_X) */
export const CONTENT_W = SLIDE_W - 2 * MARGIN_X;
/** Gap between adjacent cards / columns */
export const GUTTER = 0.35;

// ============================================================
// Title Area
// ============================================================

/** Title text box Y */
export const TITLE_Y = MARGIN_TOP;
/** Title text box height */
export const TITLE_H = 0.7;
/** Y where body content starts (below title + accent bar) */
export const BODY_Y = 1.35;
/** Available body height (from BODY_Y to footer zone) */
export const BODY_H = 3.8;

// ============================================================
// Accent Bars
// ============================================================

/** Standard accent bar height (thicker than old 0.06) */
export const ACCENT_H = 0.09;
/** Accent bar width for title underlines */
export const ACCENT_W = 1.4;
/** Accent bar Y below title */
export const ACCENT_Y = TITLE_Y + TITLE_H + 0.05;

// ============================================================
// Cards
// ============================================================

/** Border radius for card shapes (inches) */
export const CARD_RADIUS = 0.08;
/** Card internal padding */
export const CARD_PAD = 0.25;

// ============================================================
// Footer / Slide Master
// ============================================================

/** Footer strip height */
export const FOOTER_H = 0.28;
/** Footer strip Y */
export const FOOTER_Y = SLIDE_H - FOOTER_H;
/** Slide‐number X position */
export const SLIDE_NUM_X = SLIDE_W - MARGIN_X - 0.6;
/** Slide‐number width */
export const SLIDE_NUM_W = 0.6;

// ============================================================
// Chart Area
// ============================================================

/** Default chart width (without commentary) */
export const CHART_FULL_W = CONTENT_W;
/** Chart width when commentary panel present */
export const CHART_WITH_COMMENT_W = 6.0;
/** Commentary panel X (right of chart) */
export const COMMENT_X = 6.9;
/** Commentary panel width */
export const COMMENT_W = 2.6;

// ============================================================
// Two- / Three-Column Grid
// ============================================================

export function columnLayout(cols: number) {
  const cardW = (CONTENT_W - GUTTER * (cols - 1)) / cols;
  const startX = MARGIN_X - 0.1; // slight bleed for visual weight
  return {
    cardW,
    startX,
    positions: Array.from({ length: cols }, (_, i) => startX + i * (cardW + GUTTER)),
  };
}

// ============================================================
// Font Pairings
// ============================================================

export interface FontPairing {
  /** Display / heading font */
  headerFont: string;
  /** Body / reading font */
  bodyFont: string;
  /** Elegant quote font */
  quoteFont: string;
}

/**
 * Curated font pairings that look professional across OSes.
 * We keep only fonts that ship with Windows + macOS + Google Fonts embed.
 */
export const FONT_PAIRINGS: Record<string, FontPairing> = {
  'modern-clean': {
    headerFont: 'Century Gothic',
    bodyFont: 'Calibri',
    quoteFont: 'Georgia',
  },
  'executive': {
    headerFont: 'Garamond',
    bodyFont: 'Calibri',
    quoteFont: 'Garamond',
  },
  'tech-forward': {
    headerFont: 'Segoe UI',
    bodyFont: 'Segoe UI',
    quoteFont: 'Georgia',
  },
  'bold-statement': {
    headerFont: 'Trebuchet MS',
    bodyFont: 'Calibri',
    quoteFont: 'Georgia',
  },
  'classic-serif': {
    headerFont: 'Book Antiqua',
    bodyFont: 'Palatino Linotype',
    quoteFont: 'Book Antiqua',
  },
};

/** Default pairing used when nothing else specified */
export const DEFAULT_FONT_PAIRING: FontPairing = FONT_PAIRINGS['modern-clean'];
