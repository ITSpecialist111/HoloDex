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

  // Left accent bar
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.09, h: SLIDE_H,
    fill: { color },
  });
}

function iconsInCircles(_ctx: MotifContext): void {
  // This motif primarily affects how icons render inside their containers.
  // The icon-grid and three-column renderers already use circles.
  // We add a subtle top-right decorative circle cluster.
  const { pptxSlide, pres, theme } = _ctx;
  const color = lightenColor(theme.palette.primary, 85);
  pptxSlide.addShape(pres.shapes.OVAL, {
    x: SLIDE_W - 1.4, y: -0.4, w: 1.8, h: 1.8,
    fill: { color, transparency: 70 },
  });
  pptxSlide.addShape(pres.shapes.OVAL, {
    x: SLIDE_W - 0.8, y: -0.6, w: 0.9, h: 0.9,
    fill: { color, transparency: 50 },
  });
}

function roundedCards(_ctx: MotifContext): void {
  // Rounded cards motif = thicker bottom accent strip instead of left border
  const { pptxSlide, pres, theme, isDark } = _ctx;
  const accentColor = isDark
    ? lightenColor(theme.palette.primary, 40)
    : theme.palette.primary;
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: SLIDE_H - 0.06, w: SLIDE_W, h: 0.06,
    fill: { color: accentColor },
  });
}

function sharpGeometric(ctx: MotifContext): void {
  const { pptxSlide, pres, theme, isDark } = ctx;
  const fillColor = isDark
    ? lightenColor(theme.palette.backgroundDark, 12)
    : lightenColor(theme.palette.primary, 90);

  // Angled geometric block — top-right triangle approximated via thin rectangles
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: SLIDE_W - 2.5, y: 0, w: 2.5, h: 0.12,
    fill: { color: theme.palette.primary, transparency: 30 },
  });
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: SLIDE_W - 1.8, y: 0.12, w: 1.8, h: 0.08,
    fill: { color: theme.palette.primary, transparency: 50 },
  });
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: SLIDE_W - 1.0, y: 0.20, w: 1.0, h: 0.06,
    fill: { color: theme.palette.primary, transparency: 70 },
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
  // Simulate a gradient header band with layered transparent rectangles
  const baseColor = isDark ? theme.palette.backgroundDark : theme.palette.primary;
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE_W, h: 1.0,
    fill: { color: baseColor, transparency: isDark ? 0 : 90 },
  });
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE_W * 0.6, h: 1.0,
    fill: { color: baseColor, transparency: isDark ? 30 : 95 },
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
