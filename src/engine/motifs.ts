/**
 * Visual Motif Decorators
 *
 * Each visual motif produces a set of decorative shapes that get layered
 * onto slides to give the deck a consistent personality.  The renderers
 * call `applyMotifDecorations()` and the motif module figures out what
 * shapes to add based on the theme's `visualMotif` setting.
 */

import type { DesignTheme as Theme } from '../schemas.js';
import {
  SLIDE_W, SLIDE_H, MARGIN_X, ACCENT_H, CARD_RADIUS,
} from './layout.js';
import { lightenColor, darkenColor } from './theme-resolver.js';

type PptxSlide = any;
type PptxPres = any;

/** Motif context passed to each decorator */
export interface MotifContext {
  pptxSlide: PptxSlide;
  pres: PptxPres;
  theme: Theme;
  isDark: boolean;
}

// ============================================================
// Per-motif decorators
// ============================================================

function accentBorders(ctx: MotifContext): void {
  const { pptxSlide, pres, theme, isDark } = ctx;
  const color = theme.palette.accent === 'FFFFFF'
    ? theme.palette.primary
    : theme.palette.accent;
  const primaryColor = theme.palette.primary;

  // Bold left accent bar
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.14, h: SLIDE_H,
    fill: { color },
  });

  // Subtle matching thin right bar
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: SLIDE_W - 0.04, y: 0, w: 0.04, h: SLIDE_H,
    fill: { color, transparency: 60 },
  });

  // Small decorative circle top-right
  pptxSlide.addShape(pres.shapes.OVAL, {
    x: SLIDE_W - 1.2, y: -0.3, w: 1.0, h: 1.0,
    fill: { color: primaryColor, transparency: 90 },
  });
}

function iconsInCircles(_ctx: MotifContext): void {
  // Decorative circle cluster — top-right and bottom-left for balance
  const { pptxSlide, pres, theme } = _ctx;
  const color = lightenColor(theme.palette.primary, 75);
  const accentCircle = theme.palette.accent !== 'FFFFFF' ? theme.palette.accent : theme.palette.secondary;
  // Top-right cluster
  pptxSlide.addShape(pres.shapes.OVAL, {
    x: SLIDE_W - 1.8, y: -0.6, w: 2.4, h: 2.4,
    fill: { color, transparency: 65 },
  });
  pptxSlide.addShape(pres.shapes.OVAL, {
    x: SLIDE_W - 1.0, y: -0.3, w: 1.2, h: 1.2,
    fill: { color: accentCircle, transparency: 78 },
  });
  // Bottom-left subtle circle
  pptxSlide.addShape(pres.shapes.OVAL, {
    x: -0.5, y: SLIDE_H - 1.2, w: 1.5, h: 1.5,
    fill: { color, transparency: 82 },
  });
}

function roundedCards(_ctx: MotifContext): void {
  // Rounded cards motif = thick bottom accent strip + subtle top highlight
  const { pptxSlide, pres, theme, isDark } = _ctx;
  const accentColor = isDark
    ? lightenColor(theme.palette.primary, 40)
    : theme.palette.primary;
  // Bottom accent strip
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: SLIDE_H - 0.10, w: SLIDE_W, h: 0.10,
    fill: { color: accentColor },
  });
  // Subtle top line
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE_W, h: 0.03,
    fill: { color: accentColor, transparency: 50 },
  });
}

function sharpGeometric(ctx: MotifContext): void {
  const { pptxSlide, pres, theme, isDark } = ctx;
  const fillColor = isDark
    ? lightenColor(theme.palette.backgroundDark, 12)
    : lightenColor(theme.palette.primary, 90);

  // Bold angled geometric blocks — top-right
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: SLIDE_W - 3.0, y: 0, w: 3.0, h: 0.16,
    fill: { color: theme.palette.primary, transparency: 25 },
  });
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: SLIDE_W - 2.2, y: 0.16, w: 2.2, h: 0.10,
    fill: { color: theme.palette.primary, transparency: 45 },
  });
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: SLIDE_W - 1.4, y: 0.26, w: 1.4, h: 0.07,
    fill: { color: theme.palette.primary, transparency: 65 },
  });

  // Bottom-left angular accent
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: SLIDE_H - 0.12, w: 2.5, h: 0.12,
    fill: { color: theme.palette.primary, transparency: 30 },
  });
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: SLIDE_H - 0.20, w: 1.5, h: 0.08,
    fill: { color: theme.palette.primary, transparency: 55 },
  });
}

function minimalLines(ctx: MotifContext): void {
  const { pptxSlide, pres, theme, isDark } = ctx;
  const lineColor = isDark
    ? lightenColor(theme.palette.backgroundDark, 20)
    : lightenColor(theme.palette.primary, 80);

  // Subtle horizontal line near bottom
  pptxSlide.addShape(pres.shapes.LINE, {
    x: MARGIN_X, y: SLIDE_H - 0.5, w: SLIDE_W - 2 * MARGIN_X, h: 0,
    line: { color: lineColor, width: 0.5 },
  });
}

function gradientHeaders(ctx: MotifContext): void {
  const { pptxSlide, pres, theme, isDark } = ctx;
  // Simulated gradient header band with layered transparent rectangles
  const baseColor = isDark ? theme.palette.backgroundDark : theme.palette.primary;
  const accentColor = theme.palette.accent !== 'FFFFFF' ? theme.palette.accent : theme.palette.secondary;
  // Full-width header band
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE_W, h: 1.15,
    fill: { color: baseColor, transparency: isDark ? 0 : 88 },
  });
  // Left-heavy overlay for gradient feel
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE_W * 0.5, h: 1.15,
    fill: { color: baseColor, transparency: isDark ? 25 : 92 },
  });
  // Bottom edge highlight
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 1.12, w: SLIDE_W, h: 0.03,
    fill: { color: accentColor, transparency: 40 },
  });
}

// ============================================================
// Dispatcher
// ============================================================

const MOTIF_HANDLERS: Record<string, (ctx: MotifContext) => void> = {
  'accent-borders': accentBorders,
  'icons-in-circles': iconsInCircles,
  'rounded-cards': roundedCards,
  'sharp-geometric': sharpGeometric,
  'minimal-lines': minimalLines,
  'gradient-headers': gradientHeaders,
};

/**
 * Apply the theme's visual motif decorations to a slide.
 * Call this AFTER setting background but BEFORE drawing content.
 *
 * Title, section, closing, quote, and full-image slides skip motifs
 * (they have their own strong visual identity).
 */
export function applyMotifDecorations(
  pptxSlide: PptxSlide,
  pres: PptxPres,
  theme: Theme,
  isDark: boolean,
  skipMotif = false,
): void {
  if (skipMotif) return;
  const motif = theme.visualMotif;
  if (!motif) return;

  const handler = MOTIF_HANDLERS[motif];
  if (handler) {
    handler({ pptxSlide, pres, theme, isDark });
  }
}
