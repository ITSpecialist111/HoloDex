/**
 * Slide Renderers — v2 (killer edition)
 *
 * Changes from v1:
 *  • Layout constants from layout.ts instead of magic numbers
 *  • Visual-motif decorations on every content slide
 *  • Rounded-corner cards (CARD_RADIUS)
 *  • Thicker accent bars (ACCENT_H)
 *  • Dark-mode-aware chart areas
 *  • Page-number + brand footer on every slide
 *  • quoteFont used on quote slides
 */

import type {
  Slide,
  SlideRenderContext,
  TitleSlide,
  SectionSlide,
  ContentSlide,
  TwoColumnSlide,
  ThreeColumnSlide,
  BulletListSlide,
  ChartBarSlide,
  ChartLineSlide,
  ChartPieSlide,
  ChartDoughnutSlide,
  ComparisonSlide,
  StatCalloutSlide,
  TimelineSlide,
  ImageTextSlide,
  IconGridSlide,
  QuoteSlide,
  TableSlide,
  TeamSlide,
  ClosingSlide,
  AgendaSlide,
  BlankSlide,
  FullImageSlide,
  DesignTheme,
  ImageRef,
} from '../schemas.js';
import { iconToBase64Png } from '../utils/icon-renderer.js';
import {
  getChartColors,
  lightenColor,
  darkenColor,
  isDarkColor,
  getContrastTextColor,
} from './theme-resolver.js';
import { logger } from '../utils/logger.js';
import { applyMotifDecorations } from './motifs.js';
import {
  SLIDE_W, SLIDE_H,
  MARGIN_X, MARGIN_TOP, CONTENT_W, GUTTER,
  TITLE_Y, TITLE_H, BODY_Y, BODY_H,
  ACCENT_H, ACCENT_W, ACCENT_Y,
  CARD_RADIUS, CARD_PAD,
  FOOTER_H, FOOTER_Y, SLIDE_NUM_X, SLIDE_NUM_W,
  CHART_FULL_W, CHART_WITH_COMMENT_W, COMMENT_X, COMMENT_W,
  columnLayout,
} from './layout.js';

type PptxSlide = any; // PptxGenJS slide type

// ============================================================
// Helper Functions
// ============================================================

/**
 * Factory functions for shadow to avoid PptxGenJS mutation bug.
 */
function makeShadow(overrides?: Partial<{ type: string; color: string; blur: number; offset: number; angle: number; opacity: number }>) {
  return {
    type: 'outer' as const,
    color: '000000',
    blur: 6,
    offset: 2,
    angle: 135,
    opacity: 0.15,
    ...overrides,
  };
}

function makeCardShadow() {
  return makeShadow({ blur: 10, offset: 3, opacity: 0.10 });
}

/**
 * Apply slide background based on slide config and theme
 */
function applyBackground(
  pptxSlide: PptxSlide,
  slide: Slide,
  theme: DesignTheme,
): void {
  if (slide.backgroundOverride) {
    if (typeof slide.backgroundOverride === 'string') {
      pptxSlide.background = { color: slide.backgroundOverride };
    } else {
      const img = slide.backgroundOverride as ImageRef;
      if (img.base64) {
        pptxSlide.background = { data: img.base64 };
      } else if (img.url) {
        pptxSlide.background = { path: img.url };
      }
    }
  } else if (slide.darkBackground) {
    pptxSlide.background = { color: theme.palette.backgroundDark };
  } else {
    pptxSlide.background = { color: theme.palette.background };
  }
}

/**
 * Add speaker notes to a slide
 */
function addSpeakerNotes(pptxSlide: PptxSlide, notes?: string): void {
  if (notes) {
    pptxSlide.addNotes(notes);
  }
}

/**
 * Get text color based on whether slide has dark background
 */
function getTextColor(slide: Slide, theme: DesignTheme): string {
  return slide.darkBackground ? theme.palette.textOnDark : theme.palette.text;
}

function getSubTextColor(slide: Slide, theme: DesignTheme): string {
  return slide.darkBackground ? lightenColor(theme.palette.textOnDark, 20) : theme.palette.textLight;
}

/**
 * Parse body text into text array with line breaks
 */
function bodyToTextArray(body: string, options: Record<string, any> = {}): Array<{ text: string; options: Record<string, any> }> {
  const lines = body.split('\n');
  return lines.map((line, i) => ({
    text: line,
    options: {
      ...options,
      breakLine: i < lines.length - 1,
    },
  }));
}

// ============================================================
// Footer / Page Number — added to EVERY rendered slide
// ============================================================

function addFooter(
  pptxSlide: PptxSlide,
  pres: any,
  ctx: SlideRenderContext,
  isDarkSlide: boolean,
): void {
  const t = ctx.theme;
  const typo = t.typography!;
  const footerColor = isDarkSlide
    ? lightenColor(t.palette.backgroundDark, 12)
    : lightenColor(t.palette.primary, 88);
  const footerTextColor = isDarkSlide
    ? lightenColor(t.palette.textOnDark, 30)
    : t.palette.textLight;

  // Subtle footer strip
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: FOOTER_Y, w: SLIDE_W, h: FOOTER_H,
    fill: { color: footerColor, transparency: isDarkSlide ? 50 : 0 },
  });

  // Brand name (left)
  const brandName = ctx.brand?.companyName || '';
  if (brandName) {
    pptxSlide.addText(brandName, {
      x: MARGIN_X, y: FOOTER_Y, w: 4, h: FOOTER_H,
      fontSize: 8,
      fontFace: typo.bodyFont,
      color: footerTextColor,
      valign: 'middle',
      margin: 0,
    });
  }

  // Page number (right)
  pptxSlide.addText(`${ctx.slideIndex + 1}`, {
    x: SLIDE_NUM_X, y: FOOTER_Y, w: SLIDE_NUM_W, h: FOOTER_H,
    fontSize: 9,
    fontFace: typo.bodyFont,
    color: footerTextColor,
    align: 'right',
    valign: 'middle',
    margin: 0,
  });

  // Small brand logo in footer if available
  if (ctx.brand?.logoBase64 && !isDarkSlide) {
    pptxSlide.addImage({
      data: ctx.brand.logoBase64,
      x: SLIDE_W / 2 - 0.4, y: FOOTER_Y + 0.02, w: 0.8, h: FOOTER_H - 0.04,
      sizing: { type: 'contain', w: 0.8, h: FOOTER_H - 0.04 },
    });
  }
}

// ============================================================
// Title accent line helper
// ============================================================

function addTitleAccent(pptxSlide: PptxSlide, pres: any, theme: DesignTheme): void {
  pptxSlide.addShape(pres.shapes.RECTANGLE, {
    x: MARGIN_X, y: ACCENT_Y, w: ACCENT_W + 0.3, h: 0.10,
    fill: { color: theme.palette.primary },
    rectRadius: 0.05,
  });
}

// ============================================================
// Chart area fill helper (dark-mode aware)
// ============================================================

function chartAreaFill(slide: Slide, theme: DesignTheme): Record<string, any> {
  if (slide.darkBackground) {
    return { fill: { color: lightenColor(theme.palette.backgroundDark, 8) }, roundedCorners: true };
  }
  return { fill: { color: theme.palette.background }, roundedCorners: true };
}

function chartAxisColor(slide: Slide, theme: DesignTheme): string {
  return slide.darkBackground ? lightenColor(theme.palette.textOnDark, 40) : theme.palette.textLight;
}

function chartGridColor(slide: Slide, theme: DesignTheme): string {
  return slide.darkBackground ? lightenColor(theme.palette.backgroundDark, 18) : 'E2E8F0';
}

function chartDataLabelColor(slide: Slide, theme: DesignTheme): string {
  return slide.darkBackground ? theme.palette.textOnDark : theme.palette.text;
}

// ============================================================
// Slide Renderers
// ============================================================

export async function renderTitleSlide(
  slide: TitleSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;
  const accentColor = t.palette.accent === 'FFFFFF' ? t.palette.secondary : t.palette.accent;
  const primaryColor = t.palette.primary;

  // Dark background for title slides
  pptxSlide.background = { color: t.palette.backgroundDark };

  // ── Decorative shapes ──────────────────────────────────
  // Large translucent circle — bottom-right (hero graphic)
  pptxSlide.addShape(ctx.pres.shapes.OVAL, {
    x: SLIDE_W - 3.8, y: SLIDE_H - 3.2, w: 5.0, h: 5.0,
    fill: { color: primaryColor, transparency: 88 },
  });
  // Smaller accent circle overlapping
  pptxSlide.addShape(ctx.pres.shapes.OVAL, {
    x: SLIDE_W - 2.0, y: SLIDE_H - 2.6, w: 2.8, h: 2.8,
    fill: { color: accentColor, transparency: 82 },
  });
  // Top-left subtle circle
  pptxSlide.addShape(ctx.pres.shapes.OVAL, {
    x: -0.8, y: -0.8, w: 2.0, h: 2.0,
    fill: { color: primaryColor, transparency: 92 },
  });

  // Thick left accent bar (full height)
  pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.14, h: SLIDE_H,
    fill: { color: accentColor },
  });

  // Thin top accent strip
  pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
    x: 0.14, y: 0, w: SLIDE_W - 0.14, h: 0.04,
    fill: { color: primaryColor, transparency: 40 },
  });

  // Brand logo if available
  if (ctx.brand?.logoBase64) {
    pptxSlide.addImage({
      data: ctx.brand.logoBase64,
      x: MARGIN_X + 0.2, y: 0.5, w: 1.2, h: 0.6,
      sizing: { type: 'contain', w: 1.2, h: 0.6 },
    });
  }

  // Title
  const titleYPos = ctx.brand?.logoBase64 ? 1.5 : 1.0;
  pptxSlide.addText(slide.title, {
    x: MARGIN_X + 0.2, y: titleYPos, w: CONTENT_W * 0.75, h: 1.8,
    fontSize: typo.titleSize + 6,
    fontFace: typo.headerFont,
    color: t.palette.textOnDark,
    bold: true,
    align: 'left',
    valign: 'bottom',
    margin: 0,
    lineSpacingMultiple: 1.1,
  });

  // Wide accent line under title
  pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
    x: MARGIN_X + 0.2, y: titleYPos + 1.9, w: 3.0, h: 0.12,
    fill: { color: accentColor },
    rectRadius: 0.06,
  });

  // Subtitle
  if (slide.subtitle) {
    pptxSlide.addText(slide.subtitle, {
      x: MARGIN_X + 0.2, y: titleYPos + 2.2, w: CONTENT_W * 0.7, h: 0.8,
      fontSize: typo.subtitleSize + 2,
      fontFace: typo.bodyFont,
      color: lightenColor(t.palette.textOnDark, 25),
      align: 'left',
      valign: 'top',
      margin: 0,
      lineSpacingMultiple: 1.3,
    });
  }

  // Author and date at bottom-left
  const bottomItems: string[] = [];
  if (slide.author) bottomItems.push(slide.author);
  if (slide.date) bottomItems.push(slide.date);
  if (bottomItems.length > 0) {
    pptxSlide.addText(bottomItems.join('  \u2022  '), {
      x: MARGIN_X + 0.2, y: 4.5, w: CONTENT_W, h: 0.4,
      fontSize: typo.captionSize + 1,
      fontFace: typo.bodyFont,
      color: lightenColor(t.palette.textOnDark, 40),
      align: 'left',
      margin: 0,
    });
  }

  // Bottom accent bar
  pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
    x: 0, y: SLIDE_H - 0.08, w: SLIDE_W, h: 0.08,
    fill: { color: primaryColor },
  });

  addFooter(pptxSlide, ctx.pres, ctx, true);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

export async function renderSectionSlide(
  slide: SectionSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;
  const accentColor = t.palette.accent === 'FFFFFF' ? t.palette.secondary : t.palette.accent;
  const primaryColor = t.palette.primary;

  // Dark background for section dividers
  pptxSlide.background = { color: t.palette.backgroundDark };

  // ── Decorative shapes ──────────────────────────────────
  // Right-side colored block
  pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
    x: SLIDE_W - 2.5, y: 0, w: 2.5, h: SLIDE_H,
    fill: { color: primaryColor, transparency: 85 },
  });
  // Large circle — top-right
  pptxSlide.addShape(ctx.pres.shapes.OVAL, {
    x: SLIDE_W - 3.0, y: -1.0, w: 3.5, h: 3.5,
    fill: { color: accentColor, transparency: 85 },
  });
  // Small circle — bottom-left
  pptxSlide.addShape(ctx.pres.shapes.OVAL, {
    x: -0.5, y: SLIDE_H - 1.5, w: 1.8, h: 1.8,
    fill: { color: primaryColor, transparency: 90 },
  });

  // Left accent bar
  pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.14, h: SLIDE_H,
    fill: { color: accentColor },
  });

  // Section number if provided
  if (slide.sectionNumber) {
    pptxSlide.addText(String(slide.sectionNumber).padStart(2, '0'), {
      x: MARGIN_X + 0.2, y: 0.4, w: 2.5, h: 1.6,
      fontSize: 88,
      fontFace: typo.headerFont,
      color: accentColor,
      bold: true,
      align: 'left',
      margin: 0,
      transparency: 15,
    });
  }

  // Section title
  pptxSlide.addText(slide.title, {
    x: MARGIN_X + 0.2, y: 1.8, w: CONTENT_W * 0.7, h: 1.5,
    fontSize: typo.titleSize + 2,
    fontFace: typo.headerFont,
    color: t.palette.textOnDark,
    bold: true,
    align: 'left',
    valign: 'middle',
    margin: 0,
  });

  // Accent line under title
  pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
    x: MARGIN_X + 0.2, y: 3.35, w: 2.0, h: 0.10,
    fill: { color: accentColor },
    rectRadius: 0.05,
  });

  // Subtitle
  if (slide.subtitle) {
    pptxSlide.addText(slide.subtitle, {
      x: MARGIN_X + 0.2, y: 3.6, w: CONTENT_W * 0.65, h: 0.8,
      fontSize: typo.subtitleSize,
      fontFace: typo.bodyFont,
      color: lightenColor(t.palette.textOnDark, 30),
      align: 'left',
      margin: 0,
      lineSpacingMultiple: 1.3,
    });
  }

  // Bottom accent strip
  pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
    x: 0, y: SLIDE_H - 0.06, w: SLIDE_W, h: 0.06,
    fill: { color: primaryColor },
  });

  addFooter(pptxSlide, ctx.pres, ctx, true);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

export async function renderContentSlide(
  slide: ContentSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;

  applyBackground(pptxSlide, slide, t);
  const isDark = !!slide.darkBackground;
  applyMotifDecorations(pptxSlide, ctx.pres, t, isDark);
  const textColor = getTextColor(slide, t);
  const subColor = getSubTextColor(slide, t);

  // Subtle header background band
  const headerBandColor = isDark
    ? lightenColor(t.palette.backgroundDark, 6)
    : lightenColor(t.palette.primary, 94);
  pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE_W, h: BODY_Y - 0.1,
    fill: { color: headerBandColor },
  });

  // Title
  pptxSlide.addText(slide.title, {
    x: MARGIN_X, y: TITLE_Y, w: CONTENT_W, h: TITLE_H,
    fontSize: typo.headingSize + 2,
    fontFace: typo.headerFont,
    color: textColor,
    bold: true,
    margin: 0,
  });

  // Accent line under title
  addTitleAccent(pptxSlide, ctx.pres, t);

  const aiImg = resolveAiImage(ctx);
  const hasImage = aiImg || (slide.image && (slide.image.base64 || slide.image.url));
  const contentWidth = hasImage ? 5.4 : CONTENT_W;

  // Body text
  pptxSlide.addText(bodyToTextArray(slide.body, {
    fontSize: typo.bodySize,
    fontFace: typo.bodyFont,
    color: subColor,
  }), {
    x: MARGIN_X, y: BODY_Y, w: contentWidth, h: BODY_H,
    valign: 'top',
    margin: 0,
    lineSpacingMultiple: 1.3,
  });

  // Image on the right if provided (AI image takes priority)
  if (hasImage) {
    const imgX = 6.3;
    const imgW = SLIDE_W - imgX - MARGIN_X + 0.3;
    const imgProps: any = {
      x: imgX, y: BODY_Y, w: imgW, h: BODY_H,
      sizing: { type: 'contain', w: imgW, h: BODY_H },
    };
    if (aiImg) imgProps.data = aiImg;
    else if (slide.image!.base64) imgProps.data = slide.image!.base64;
    else if (slide.image!.url) imgProps.path = slide.image!.url;
    pptxSlide.addImage(imgProps);
  }

  // Icon if provided (and no image)
  if (slide.icon && !hasImage) {
    try {
      const iconData = await iconToBase64Png({
        ...slide.icon,
        color: slide.icon.color || t.palette.primary,
      });
      pptxSlide.addImage({
        data: iconData,
        x: SLIDE_W - MARGIN_X - 0.5, y: TITLE_Y + 0.05, w: 0.5, h: 0.5,
      });
    } catch (e) {
      logger.warn('Failed to render icon', e);
    }
  }

  addFooter(pptxSlide, ctx.pres, ctx, isDark);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

export async function renderTwoColumnSlide(
  slide: TwoColumnSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;

  applyBackground(pptxSlide, slide, t);
  const isDark = !!slide.darkBackground;
  applyMotifDecorations(pptxSlide, ctx.pres, t, isDark);
  const textColor = getTextColor(slide, t);
  const subColor = getSubTextColor(slide, t);

  // Title
  pptxSlide.addText(slide.title, {
    x: MARGIN_X, y: TITLE_Y, w: CONTENT_W, h: TITLE_H,
    fontSize: typo.headingSize,
    fontFace: typo.headerFont,
    color: textColor,
    bold: true,
    margin: 0,
  });

  const layout = columnLayout(2);
  const cardFill = isDark ? lightenColor(t.palette.backgroundDark, 10) : 'FFFFFF';
  const accentColors = [t.palette.primary, t.palette.secondary !== 'E8ECEF' ? t.palette.secondary : t.palette.accent];

  for (let i = 0; i < 2; i++) {
    const x = layout.positions[i];
    const content = i === 0 ? slide.leftContent : slide.rightContent;
    const title = i === 0 ? slide.leftTitle : slide.rightTitle;

    // Card background (rounded, elevated)
    pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
      x, y: BODY_Y, w: layout.cardW, h: BODY_H,
      fill: { color: cardFill },
      shadow: makeShadow({ blur: 12, offset: 4, opacity: 0.12 }),
      rectRadius: CARD_RADIUS * 1.5,
    });

    // Thick left accent bar on card
    pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
      x, y: BODY_Y + CARD_RADIUS, w: 0.12, h: BODY_H - CARD_RADIUS * 2,
      fill: { color: accentColors[i] },
      rectRadius: 0.06,
    });

    if (title) {
      pptxSlide.addText(title, {
        x: x + CARD_PAD + 0.05, y: BODY_Y + 0.15, w: layout.cardW - CARD_PAD * 2, h: 0.5,
        fontSize: typo.bodySize + 2,
        fontFace: typo.headerFont,
        color: textColor,
        bold: true,
        margin: 0,
      });
    }

    pptxSlide.addText(bodyToTextArray(content, {
      fontSize: typo.bodySize,
      fontFace: typo.bodyFont,
      color: subColor,
    }), {
      x: x + CARD_PAD + 0.05, y: title ? BODY_Y + 0.7 : BODY_Y + 0.2,
      w: layout.cardW - CARD_PAD * 2, h: title ? BODY_H - 0.9 : BODY_H - 0.4,
      valign: 'top',
      margin: 0,
      lineSpacingMultiple: 1.3,
    });
  }

  addFooter(pptxSlide, ctx.pres, ctx, isDark);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

export async function renderThreeColumnSlide(
  slide: ThreeColumnSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;

  applyBackground(pptxSlide, slide, t);
  const isDark = !!slide.darkBackground;
  applyMotifDecorations(pptxSlide, ctx.pres, t, isDark);
  const textColor = getTextColor(slide, t);
  const subColor = getSubTextColor(slide, t);

  // Title
  pptxSlide.addText(slide.title, {
    x: MARGIN_X, y: TITLE_Y, w: CONTENT_W, h: TITLE_H,
    fontSize: typo.headingSize,
    fontFace: typo.headerFont,
    color: textColor,
    bold: true,
    margin: 0,
  });

  const layout = columnLayout(3);
  const colColors = [t.palette.primary, t.palette.secondary, t.palette.accent];
  const cardFill = isDark ? lightenColor(t.palette.backgroundDark, 10) : 'FFFFFF';

  for (let i = 0; i < 3; i++) {
    const col = slide.columns[i];
    const x = layout.positions[i];
    const cardColor = colColors[i] !== 'FFFFFF' ? colColors[i] : t.palette.primary;

    // Card background (rounded, elevated)
    pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
      x, y: BODY_Y, w: layout.cardW, h: BODY_H,
      fill: { color: cardFill },
      shadow: makeShadow({ blur: 12, offset: 4, opacity: 0.12 }),
      rectRadius: CARD_RADIUS * 1.5,
    });

    // Thick top accent bar (inset from rounded corners)
    pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
      x: x + CARD_RADIUS, y: BODY_Y, w: layout.cardW - CARD_RADIUS * 2, h: 0.14,
      fill: { color: cardColor },
      rectRadius: 0.04,
    });

    // Icon if provided
    let contentY = BODY_Y + 0.3;
    if (col.icon) {
      try {
        const iconData = await iconToBase64Png({
          ...col.icon,
          color: col.icon.color || colColors[i],
        });
        pptxSlide.addImage({
          data: iconData,
          x: x + layout.cardW / 2 - 0.25, y: BODY_Y + 0.25, w: 0.5, h: 0.5,
        });
        contentY = BODY_Y + 0.9;
      } catch (e) {
        logger.warn('Failed to render column icon', e);
      }
    }

    // Column title
    if (col.title) {
      pptxSlide.addText(col.title, {
        x: x + CARD_PAD, y: contentY, w: layout.cardW - CARD_PAD * 2, h: 0.5,
        fontSize: typo.bodySize + 2,
        fontFace: typo.headerFont,
        color: textColor,
        bold: true,
        align: 'center',
        margin: 0,
      });
      contentY += 0.5;
    }

    // Column content
    pptxSlide.addText(bodyToTextArray(col.content, {
      fontSize: typo.bodySize,
      fontFace: typo.bodyFont,
      color: subColor,
    }), {
      x: x + CARD_PAD, y: contentY + 0.1, w: layout.cardW - CARD_PAD * 2, h: BODY_Y + BODY_H - contentY - 0.3,
      valign: 'top',
      align: 'center',
      margin: 0,
      lineSpacingMultiple: 1.3,
    });
  }

  addFooter(pptxSlide, ctx.pres, ctx, isDark);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

export async function renderBulletListSlide(
  slide: BulletListSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;

  applyBackground(pptxSlide, slide, t);
  const isDark = !!slide.darkBackground;
  applyMotifDecorations(pptxSlide, ctx.pres, t, isDark);
  const textColor = getTextColor(slide, t);
  const subColor = getSubTextColor(slide, t);

  // Subtle header background band
  const headerBandColor = isDark
    ? lightenColor(t.palette.backgroundDark, 6)
    : lightenColor(t.palette.primary, 94);
  pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE_W, h: BODY_Y - 0.1,
    fill: { color: headerBandColor },
  });

  // Title
  pptxSlide.addText(slide.title, {
    x: MARGIN_X, y: TITLE_Y, w: CONTENT_W, h: TITLE_H,
    fontSize: typo.headingSize + 2,
    fontFace: typo.headerFont,
    color: textColor,
    bold: true,
    margin: 0,
  });

  addTitleAccent(pptxSlide, ctx.pres, t);

  // Build bullet items — colored bullet markers
  const textItems: Array<{ text: string; options: Record<string, any> }> = [];

  for (const item of slide.items) {
    textItems.push({
      text: item.text,
      options: {
        bullet: { type: 'bullet', characterCode: '25CF' },
        fontSize: typo.bodySize + 1,
        fontFace: typo.bodyFont,
        color: textColor,
        bold: true,
        breakLine: true,
        paraSpaceAfter: 8,
        paraSpaceBefore: 4,
      },
    });

    if (item.subItems) {
      for (const sub of item.subItems) {
        textItems.push({
          text: sub,
          options: {
            bullet: { type: 'bullet', characterCode: '25CB' },
            indentLevel: 1,
            fontSize: typo.bodySize,
            fontFace: typo.bodyFont,
            color: subColor,
            breakLine: true,
            paraSpaceAfter: 4,
          },
        });
      }
    }
  }

  pptxSlide.addText(textItems, {
    x: MARGIN_X, y: BODY_Y, w: CONTENT_W, h: BODY_H,
    valign: 'top',
    margin: 0,
  });

  addFooter(pptxSlide, ctx.pres, ctx, isDark);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

export async function renderChartBarSlide(
  slide: ChartBarSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;

  applyBackground(pptxSlide, slide, t);
  const isDark = !!slide.darkBackground;
  applyMotifDecorations(pptxSlide, ctx.pres, t, isDark);
  const textColor = getTextColor(slide, t);

  // Title
  pptxSlide.addText(slide.title, {
    x: MARGIN_X, y: TITLE_Y, w: CONTENT_W, h: TITLE_H,
    fontSize: typo.headingSize,
    fontFace: typo.headerFont,
    color: textColor,
    bold: true,
    margin: 0,
  });

  const chartColors = getChartColors(t.palette);
  const chartW = slide.commentary ? CHART_WITH_COMMENT_W : CHART_FULL_W;
  const axisColor = chartAxisColor(slide, t);
  const gridColor = chartGridColor(slide, t);

  pptxSlide.addChart(ctx.pres.charts.BAR, slide.series, {
    x: MARGIN_X - 0.1, y: BODY_Y, w: chartW, h: BODY_H,
    barDir: slide.horizontal ? 'bar' : 'col',
    barGrouping: slide.stacked ? 'stacked' : 'clustered',
    chartColors,
    chartArea: chartAreaFill(slide, t),
    catAxisLabelColor: axisColor,
    valAxisLabelColor: axisColor,
    catAxisLabelFontSize: 10,
    valAxisLabelFontSize: 10,
    valGridLine: { color: gridColor, size: 0.5 },
    catGridLine: { style: 'none' },
    showValue: true,
    dataLabelPosition: 'outEnd',
    dataLabelColor: chartDataLabelColor(slide, t),
    dataLabelFontSize: 9,
    showLegend: slide.series.length > 1,
    legendPos: 'b',
    legendColor: axisColor,
  });

  if (slide.commentary) {
    pptxSlide.addText(slide.commentary, {
      x: COMMENT_X, y: BODY_Y + 0.2, w: COMMENT_W, h: BODY_H - 0.4,
      fontSize: typo.bodySize - 1,
      fontFace: typo.bodyFont,
      color: getSubTextColor(slide, t),
      valign: 'top',
      margin: 0,
      lineSpacingMultiple: 1.4,
    });
  }

  addFooter(pptxSlide, ctx.pres, ctx, isDark);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

export async function renderChartLineSlide(
  slide: ChartLineSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;

  applyBackground(pptxSlide, slide, t);
  const isDark = !!slide.darkBackground;
  applyMotifDecorations(pptxSlide, ctx.pres, t, isDark);
  const textColor = getTextColor(slide, t);

  pptxSlide.addText(slide.title, {
    x: MARGIN_X, y: TITLE_Y, w: CONTENT_W, h: TITLE_H,
    fontSize: typo.headingSize,
    fontFace: typo.headerFont,
    color: textColor,
    bold: true,
    margin: 0,
  });

  const chartColors = getChartColors(t.palette);
  const chartW = slide.commentary ? CHART_WITH_COMMENT_W : CHART_FULL_W;
  const axisColor = chartAxisColor(slide, t);
  const gridColor = chartGridColor(slide, t);

  pptxSlide.addChart(ctx.pres.charts.LINE, slide.series, {
    x: MARGIN_X - 0.1, y: BODY_Y, w: chartW, h: BODY_H,
    lineSize: 3,
    lineSmooth: slide.smooth ?? true,
    chartColors,
    chartArea: chartAreaFill(slide, t),
    catAxisLabelColor: axisColor,
    valAxisLabelColor: axisColor,
    valGridLine: { color: gridColor, size: 0.5 },
    catGridLine: { style: 'none' },
    showLegend: slide.series.length > 1,
    legendPos: 'b',
    legendColor: axisColor,
    showMarker: true,
    markerSize: 6,
  });

  if (slide.commentary) {
    pptxSlide.addText(slide.commentary, {
      x: COMMENT_X, y: BODY_Y + 0.2, w: COMMENT_W, h: BODY_H - 0.4,
      fontSize: typo.bodySize - 1,
      fontFace: typo.bodyFont,
      color: getSubTextColor(slide, t),
      valign: 'top',
      margin: 0,
      lineSpacingMultiple: 1.4,
    });
  }

  addFooter(pptxSlide, ctx.pres, ctx, isDark);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

export async function renderChartPieSlide(
  slide: ChartPieSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;

  applyBackground(pptxSlide, slide, t);
  const isDark = !!slide.darkBackground;
  applyMotifDecorations(pptxSlide, ctx.pres, t, isDark);
  const textColor = getTextColor(slide, t);
  const axisColor = chartAxisColor(slide, t);

  pptxSlide.addText(slide.title, {
    x: MARGIN_X, y: TITLE_Y, w: CONTENT_W, h: TITLE_H,
    fontSize: typo.headingSize,
    fontFace: typo.headerFont,
    color: textColor,
    bold: true,
    margin: 0,
  });

  const chartColors = getChartColors(t.palette);

  pptxSlide.addChart(ctx.pres.charts.PIE, slide.series, {
    x: slide.commentary ? 1.0 : 2.0, y: BODY_Y, w: 4.5, h: BODY_H,
    showPercent: slide.showPercent,
    chartColors,
    chartArea: chartAreaFill(slide, t),
    showLegend: true,
    legendPos: 'b',
    legendFontSize: 10,
    legendColor: axisColor,
    dataLabelColor: 'FFFFFF',
    dataLabelFontSize: 11,
  });

  if (slide.commentary) {
    pptxSlide.addText(slide.commentary, {
      x: 6.0, y: BODY_Y + 0.2, w: 3.5, h: BODY_H - 0.4,
      fontSize: typo.bodySize - 1,
      fontFace: typo.bodyFont,
      color: getSubTextColor(slide, t),
      valign: 'top',
      margin: 0,
      lineSpacingMultiple: 1.4,
    });
  }

  addFooter(pptxSlide, ctx.pres, ctx, isDark);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

export async function renderChartDoughnutSlide(
  slide: ChartDoughnutSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;

  applyBackground(pptxSlide, slide, t);
  const isDark = !!slide.darkBackground;
  applyMotifDecorations(pptxSlide, ctx.pres, t, isDark);
  const textColor = getTextColor(slide, t);
  const axisColor = chartAxisColor(slide, t);

  pptxSlide.addText(slide.title, {
    x: MARGIN_X, y: TITLE_Y, w: CONTENT_W, h: TITLE_H,
    fontSize: typo.headingSize,
    fontFace: typo.headerFont,
    color: textColor,
    bold: true,
    margin: 0,
  });

  const chartColors = getChartColors(t.palette);

  pptxSlide.addChart(ctx.pres.charts.DOUGHNUT, slide.series, {
    x: slide.commentary ? 1.0 : 2.0, y: BODY_Y, w: 4.5, h: BODY_H,
    showPercent: slide.showPercent,
    chartColors,
    chartArea: chartAreaFill(slide, t),
    showLegend: true,
    legendPos: 'b',
    legendFontSize: 10,
    legendColor: axisColor,
    dataLabelColor: chartDataLabelColor(slide, t),
    dataLabelFontSize: 11,
  });

  if (slide.commentary) {
    pptxSlide.addText(slide.commentary, {
      x: 6.0, y: BODY_Y + 0.2, w: 3.5, h: BODY_H - 0.4,
      fontSize: typo.bodySize - 1,
      fontFace: typo.bodyFont,
      color: getSubTextColor(slide, t),
      valign: 'top',
      margin: 0,
      lineSpacingMultiple: 1.4,
    });
  }

  addFooter(pptxSlide, ctx.pres, ctx, isDark);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

export async function renderComparisonSlide(
  slide: ComparisonSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;

  applyBackground(pptxSlide, slide, t);
  const isDark = !!slide.darkBackground;
  applyMotifDecorations(pptxSlide, ctx.pres, t, isDark);
  const textColor = getTextColor(slide, t);

  // Title
  pptxSlide.addText(slide.title, {
    x: MARGIN_X, y: TITLE_Y, w: CONTENT_W, h: TITLE_H,
    fontSize: typo.headingSize,
    fontFace: typo.headerFont,
    color: textColor,
    bold: true,
    margin: 0,
  });

  const layout = columnLayout(2);
  const leftColor = slide.leftColor || t.palette.primary;
  const rightColor = slide.rightColor || (t.palette.secondary !== 'E8ECEF' ? t.palette.secondary : t.palette.accent);

  // Left column header (rounded top, taller)
  pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
    x: layout.positions[0], y: BODY_Y, w: layout.cardW, h: 0.7,
    fill: { color: leftColor },
    rectRadius: CARD_RADIUS * 1.5,
    shadow: makeShadow({ blur: 6, offset: 2, opacity: 0.12 }),
  });
  pptxSlide.addText(slide.leftTitle, {
    x: layout.positions[0], y: BODY_Y, w: layout.cardW, h: 0.7,
    fontSize: typo.bodySize + 3,
    fontFace: typo.headerFont,
    color: isDarkColor(leftColor) ? 'FFFFFF' : t.palette.text,
    bold: true,
    align: 'center',
    valign: 'middle',
    margin: 0,
  });

  // Left items
  const leftItems = slide.leftItems.map((item, i) => ({
    text: item,
    options: {
      bullet: { type: 'bullet', characterCode: '25CF' },
      fontSize: typo.bodySize + 1,
      fontFace: typo.bodyFont,
      color: textColor,
      breakLine: i < slide.leftItems.length - 1,
      paraSpaceAfter: 8,
    },
  }));
  pptxSlide.addText(leftItems, {
    x: layout.positions[0] + 0.2, y: BODY_Y + 0.9, w: layout.cardW - 0.4, h: BODY_H - 1.1,
    valign: 'top',
    margin: 0,
  });

  // "VS" badge in center divider
  const midX = layout.positions[0] + layout.cardW + GUTTER / 2;
  pptxSlide.addShape(ctx.pres.shapes.LINE, {
    x: midX, y: BODY_Y, w: 0, h: BODY_H,
    line: { color: isDark ? lightenColor(t.palette.backgroundDark, 20) : 'E2E8F0', width: 1.5 },
  });
  // VS circle badge
  pptxSlide.addShape(ctx.pres.shapes.OVAL, {
    x: midX - 0.28, y: BODY_Y + BODY_H / 2 - 0.28, w: 0.56, h: 0.56,
    fill: { color: isDark ? lightenColor(t.palette.backgroundDark, 15) : 'FFFFFF' },
    shadow: makeShadow({ blur: 4, offset: 1, opacity: 0.15 }),
  });
  pptxSlide.addText('VS', {
    x: midX - 0.28, y: BODY_Y + BODY_H / 2 - 0.28, w: 0.56, h: 0.56,
    fontSize: 10,
    fontFace: typo.headerFont,
    color: isDark ? t.palette.textOnDark : t.palette.textLight,
    bold: true,
    align: 'center',
    valign: 'middle',
    margin: 0,
  });

  // Right column header (rounded top, taller)
  pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
    x: layout.positions[1], y: BODY_Y, w: layout.cardW, h: 0.7,
    fill: { color: rightColor },
    rectRadius: CARD_RADIUS * 1.5,
    shadow: makeShadow({ blur: 6, offset: 2, opacity: 0.12 }),
  });
  pptxSlide.addText(slide.rightTitle, {
    x: layout.positions[1], y: BODY_Y, w: layout.cardW, h: 0.7,
    fontSize: typo.bodySize + 3,
    fontFace: typo.headerFont,
    color: isDarkColor(rightColor) ? 'FFFFFF' : t.palette.text,
    bold: true,
    align: 'center',
    valign: 'middle',
    margin: 0,
  });

  // Right items
  const rightItems = slide.rightItems.map((item, i) => ({
    text: item,
    options: {
      bullet: { type: 'bullet', characterCode: '25CF' },
      fontSize: typo.bodySize + 1,
      fontFace: typo.bodyFont,
      color: textColor,
      breakLine: i < slide.rightItems.length - 1,
      paraSpaceAfter: 8,
    },
  }));
  pptxSlide.addText(rightItems, {
    x: layout.positions[1] + 0.2, y: BODY_Y + 0.9, w: layout.cardW - 0.4, h: BODY_H - 1.1,
    valign: 'top',
    margin: 0,
  });

  addFooter(pptxSlide, ctx.pres, ctx, isDark);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

export async function renderStatCalloutSlide(
  slide: StatCalloutSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;

  applyBackground(pptxSlide, slide, t);
  const isDark = !!slide.darkBackground;
  applyMotifDecorations(pptxSlide, ctx.pres, t, isDark);
  const textColor = getTextColor(slide, t);
  const subColor = getSubTextColor(slide, t);

  if (slide.title) {
    pptxSlide.addText(slide.title, {
      x: MARGIN_X, y: TITLE_Y, w: CONTENT_W, h: TITLE_H,
      fontSize: typo.headingSize,
      fontFace: typo.headerFont,
      color: textColor,
      bold: true,
      margin: 0,
    });
  }

  const statCount = slide.stats.length;
  const layout = columnLayout(statCount);
  const startY = slide.title ? BODY_Y : 1.0;
  const cardHeight = slide.title ? BODY_H : BODY_H + 0.3;
  const statColors = [t.palette.primary, t.palette.accent !== 'FFFFFF' ? t.palette.accent : t.palette.primary, t.palette.secondary !== 'E8ECEF' ? t.palette.secondary : t.palette.primary];

  for (let i = 0; i < statCount; i++) {
    const stat = slide.stats[i];
    const x = layout.positions[i];
    const statColor = statColors[i % statColors.length];

    // Card (rounded, elevated)
    pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
      x, y: startY, w: layout.cardW, h: cardHeight,
      fill: { color: isDark ? lightenColor(t.palette.backgroundDark, 8) : 'FFFFFF' },
      shadow: makeShadow({ blur: 12, offset: 4, opacity: 0.14 }),
      rectRadius: CARD_RADIUS * 1.5,
    });

    // Thick colored top accent bar
    pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
      x: x + CARD_RADIUS, y: startY, w: layout.cardW - CARD_RADIUS * 2, h: 0.16,
      fill: { color: statColor },
      rectRadius: 0.04,
    });

    // Subtle colored circle behind number
    const circleSize = 1.6;
    pptxSlide.addShape(ctx.pres.shapes.OVAL, {
      x: x + layout.cardW / 2 - circleSize / 2, y: startY + 0.5,
      w: circleSize, h: circleSize,
      fill: { color: statColor, transparency: 90 },
    });

    // Big number — much larger for impact
    pptxSlide.addText(stat.value, {
      x: x + CARD_PAD, y: startY + 0.4, w: layout.cardW - CARD_PAD * 2, h: 1.8,
      fontSize: 68,
      fontFace: typo.headerFont,
      color: statColor,
      bold: true,
      align: 'center',
      valign: 'middle',
      margin: 0,
    });

    // Small accent line between number and label
    pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
      x: x + layout.cardW / 2 - 0.4, y: startY + 2.3, w: 0.8, h: 0.05,
      fill: { color: statColor, transparency: 40 },
      rectRadius: 0.025,
    });

    // Label
    pptxSlide.addText(stat.label, {
      x: x + CARD_PAD, y: startY + 2.5, w: layout.cardW - CARD_PAD * 2, h: 1.0,
      fontSize: typo.bodySize + 1,
      fontFace: typo.bodyFont,
      color: subColor,
      align: 'center',
      valign: 'top',
      margin: 0,
      lineSpacingMultiple: 1.2,
    });
  }

  addFooter(pptxSlide, ctx.pres, ctx, isDark);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

export async function renderTimelineSlide(
  slide: TimelineSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;

  applyBackground(pptxSlide, slide, t);
  const isDark = !!slide.darkBackground;
  applyMotifDecorations(pptxSlide, ctx.pres, t, isDark);
  const textColor = getTextColor(slide, t);
  const subColor = getSubTextColor(slide, t);

  // Title
  pptxSlide.addText(slide.title, {
    x: MARGIN_X, y: TITLE_Y, w: CONTENT_W, h: TITLE_H,
    fontSize: typo.headingSize,
    fontFace: typo.headerFont,
    color: textColor,
    bold: true,
    margin: 0,
  });

  const stepCount = slide.steps.length;
  const lineY = 2.8;
  const startX = 1.0;
  const endX = 9.0;
  const stepSpacing = (endX - startX) / Math.max(stepCount - 1, 1);
  const accentColor = t.palette.accent !== 'FFFFFF' ? t.palette.accent : t.palette.secondary;

  // Horizontal connector line — thicker, with shadow
  pptxSlide.addShape(ctx.pres.shapes.LINE, {
    x: startX, y: lineY, w: endX - startX, h: 0,
    line: { color: lightenColor(t.palette.primary, 60), width: 4 },
  });
  // Accent overlay line on top
  pptxSlide.addShape(ctx.pres.shapes.LINE, {
    x: startX, y: lineY, w: endX - startX, h: 0,
    line: { color: t.palette.primary, width: 2 },
  });

  for (let i = 0; i < stepCount; i++) {
    const step = slide.steps[i];
    const x = startX + i * stepSpacing;
    const nodeSize = 0.56;

    // Outer glow ring
    pptxSlide.addShape(ctx.pres.shapes.OVAL, {
      x: x - nodeSize / 2 - 0.06, y: lineY - nodeSize / 2 - 0.06,
      w: nodeSize + 0.12, h: nodeSize + 0.12,
      fill: { color: t.palette.primary, transparency: 70 },
    });

    // Circle node — larger
    pptxSlide.addShape(ctx.pres.shapes.OVAL, {
      x: x - nodeSize / 2, y: lineY - nodeSize / 2, w: nodeSize, h: nodeSize,
      fill: { color: t.palette.primary },
      shadow: makeShadow({ blur: 6, offset: 2, opacity: 0.25 }),
    });

    // Step number inside circle
    pptxSlide.addText(String(i + 1), {
      x: x - nodeSize / 2, y: lineY - nodeSize / 2, w: nodeSize, h: nodeSize,
      fontSize: 16,
      fontFace: typo.headerFont,
      color: isDarkColor(t.palette.primary) ? 'FFFFFF' : t.palette.text,
      bold: true,
      align: 'center',
      valign: 'middle',
      margin: 0,
    });

    // Step title (alternating above/below)
    const isAbove = i % 2 === 0;
    const titleY = isAbove ? lineY - 1.3 : lineY + 0.55;
    const descY = isAbove ? lineY - 0.75 : lineY + 1.0;
    const textWidth = Math.min(stepSpacing * 0.9, 2.0);

    // Connecting stem line from node to text
    const stemStartY = isAbove ? lineY - nodeSize / 2 : lineY + nodeSize / 2;
    const stemEndY = isAbove ? lineY - 0.5 : lineY + 0.5;
    pptxSlide.addShape(ctx.pres.shapes.LINE, {
      x, y: Math.min(stemStartY, stemEndY), w: 0, h: Math.abs(stemEndY - stemStartY),
      line: { color: lightenColor(t.palette.primary, 40), width: 1 },
    });

    pptxSlide.addText(step.title, {
      x: x - textWidth / 2, y: titleY, w: textWidth, h: 0.5,
      fontSize: typo.bodySize + 1,
      fontFace: typo.headerFont,
      color: textColor,
      bold: true,
      align: 'center',
      valign: isAbove ? 'bottom' : 'top',
      margin: 0,
    });

    if (step.description) {
      pptxSlide.addText(step.description, {
        x: x - textWidth / 2, y: descY, w: textWidth, h: 0.6,
        fontSize: typo.captionSize,
        fontFace: typo.bodyFont,
        color: subColor,
        align: 'center',
        valign: isAbove ? 'bottom' : 'top',
        margin: 0,
      });
    }
  }

  addFooter(pptxSlide, ctx.pres, ctx, isDark);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

export async function renderImageTextSlide(
  slide: ImageTextSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;

  applyBackground(pptxSlide, slide, t);
  const isDark = !!slide.darkBackground;
  const textColor = getTextColor(slide, t);
  const subColor = getSubTextColor(slide, t);

  const imgLeft = slide.imagePosition === 'left';
  const textX = imgLeft ? 5.3 : MARGIN_X;
  const imgX = imgLeft ? 0 : 5.0;

  // Image (half-bleed) — AI-generated image takes priority
  const aiImg = resolveAiImage(ctx);
  const hasImageSource = aiImg || slide.image?.base64 || slide.image?.url;

  if (hasImageSource) {
    const imgProps: any = {
      x: imgX, y: 0, w: 5.0, h: SLIDE_H,
      sizing: { type: 'cover', w: 5.0, h: SLIDE_H },
    };
    if (aiImg) imgProps.data = aiImg;
    else if (slide.image?.base64) imgProps.data = slide.image.base64;
    else if (slide.image?.url) imgProps.path = slide.image.url;
    pptxSlide.addImage(imgProps);
  } else {
    // No image available — render a placeholder gradient instead of crashing
    pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
      x: imgX, y: 0, w: 5.0, h: SLIDE_H,
      fill: { color: t.palette.backgroundDark },
    });
    pptxSlide.addText('Image\nPlaceholder', {
      x: imgX + 1.0, y: SLIDE_H / 2 - 0.5, w: 3.0, h: 1.0,
      fontSize: 16, fontFace: t.typography!.bodyFont,
      color: t.palette.textOnDark || 'FFFFFF',
      align: 'center', valign: 'middle',
    });
  }

  // Title on text side
  pptxSlide.addText(slide.title, {
    x: textX, y: 0.5, w: 4.0, h: 0.8,
    fontSize: typo.headingSize,
    fontFace: typo.headerFont,
    color: textColor,
    bold: true,
    margin: 0,
  });

  // Accent line
  pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
    x: textX, y: 1.35, w: ACCENT_W, h: ACCENT_H,
    fill: { color: t.palette.primary },
    rectRadius: ACCENT_H / 2,
  });

  // Body text
  pptxSlide.addText(bodyToTextArray(slide.body, {
    fontSize: typo.bodySize,
    fontFace: typo.bodyFont,
    color: subColor,
  }), {
    x: textX, y: 1.6, w: 4.0, h: 3.5,
    valign: 'top',
    margin: 0,
    lineSpacingMultiple: 1.4,
  });

  addFooter(pptxSlide, ctx.pres, ctx, isDark);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

export async function renderIconGridSlide(
  slide: IconGridSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;

  applyBackground(pptxSlide, slide, t);
  const isDark = !!slide.darkBackground;
  applyMotifDecorations(pptxSlide, ctx.pres, t, isDark);
  const textColor = getTextColor(slide, t);
  const subColor = getSubTextColor(slide, t);

  // Title
  pptxSlide.addText(slide.title, {
    x: MARGIN_X, y: TITLE_Y, w: CONTENT_W, h: TITLE_H,
    fontSize: typo.headingSize,
    fontFace: typo.headerFont,
    color: textColor,
    bold: true,
    margin: 0,
  });

  const itemCount = slide.items.length;
  const cols = itemCount <= 4 ? 2 : 3;
  const rows = Math.ceil(itemCount / cols);
  const cellWidth = CONTENT_W / cols;
  const cellHeight = BODY_H / rows;
  const startX = MARGIN_X + 0.1;

  for (let i = 0; i < itemCount; i++) {
    const item = slide.items[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * cellWidth;
    const y = BODY_Y + row * cellHeight;

    // Icon in colored circle
    try {
      const iconData = await iconToBase64Png({
        ...item.icon,
        color: item.icon.color || 'FFFFFF',
      });

      // Circle background
      pptxSlide.addShape(ctx.pres.shapes.OVAL, {
        x: x + cellWidth / 2 - 0.32, y, w: 0.64, h: 0.64,
        fill: { color: t.palette.primary },
        shadow: makeShadow({ blur: 4, offset: 1, opacity: 0.15 }),
      });

      // Icon image
      pptxSlide.addImage({
        data: iconData,
        x: x + cellWidth / 2 - 0.22, y: y + 0.1, w: 0.44, h: 0.44,
      });
    } catch (e) {
      logger.warn('Failed to render grid icon', e);
    }

    // Item title
    pptxSlide.addText(item.title, {
      x, y: y + 0.75, w: cellWidth, h: 0.4,
      fontSize: typo.bodySize + 1,
      fontFace: typo.headerFont,
      color: textColor,
      bold: true,
      align: 'center',
      margin: 0,
    });

    // Item description
    if (item.description) {
      pptxSlide.addText(item.description, {
        x: x + 0.1, y: y + 1.15, w: cellWidth - 0.2, h: cellHeight - 1.3,
        fontSize: typo.captionSize + 1,
        fontFace: typo.bodyFont,
        color: subColor,
        align: 'center',
        margin: 0,
        lineSpacingMultiple: 1.2,
      });
    }
  }

  addFooter(pptxSlide, ctx.pres, ctx, isDark);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

export async function renderQuoteSlide(
  slide: QuoteSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;
  const quoteFont = (typo as any).quoteFont || 'Georgia';
  const accentColor = t.palette.accent === 'FFFFFF' ? t.palette.secondary : t.palette.accent;

  // Dark background for impact
  pptxSlide.background = { color: t.palette.backgroundDark };

  // ── Decorative elements ──────────────────────────────────
  // Left accent bar
  pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.12, h: SLIDE_H,
    fill: { color: accentColor },
  });
  // Subtle circle bottom-right
  pptxSlide.addShape(ctx.pres.shapes.OVAL, {
    x: SLIDE_W - 2.0, y: SLIDE_H - 1.8, w: 2.5, h: 2.5,
    fill: { color: t.palette.primary, transparency: 90 },
  });

  // Large decorative opening quote mark
  pptxSlide.addText('\u201C', {
    x: 0.4, y: -0.2, w: 2.5, h: 2.5,
    fontSize: 160,
    fontFace: quoteFont,
    color: accentColor,
    bold: true,
    margin: 0,
    transparency: 25,
  });

  // Closing quote mark
  pptxSlide.addText('\u201D', {
    x: SLIDE_W - 2.5, y: 2.2, w: 2.5, h: 2.5,
    fontSize: 120,
    fontFace: quoteFont,
    color: accentColor,
    bold: true,
    align: 'right',
    margin: 0,
    transparency: 45,
  });

  // Quote text (uses quoteFont)
  pptxSlide.addText(slide.quote, {
    x: 1.3, y: 1.0, w: 7.2, h: 2.8,
    fontSize: typo.subtitleSize + 4,
    fontFace: quoteFont,
    color: t.palette.textOnDark,
    italic: true,
    align: 'left',
    valign: 'middle',
    margin: 0,
    lineSpacingMultiple: 1.5,
  });

  // Attribution
  if (slide.attribution) {
    // Accent line — wider
    pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
      x: 1.3, y: 4.0, w: 1.6, h: 0.10,
      fill: { color: accentColor },
      rectRadius: 0.05,
    });

    const attrText = slide.role
      ? `${slide.attribution}\n${slide.role}`
      : slide.attribution;

    pptxSlide.addText(attrText, {
      x: 1.3, y: 4.1, w: 7.2, h: 0.8,
      fontSize: typo.bodySize,
      fontFace: typo.bodyFont,
      color: lightenColor(t.palette.textOnDark, 30),
      margin: 0,
    });
  }

  addFooter(pptxSlide, ctx.pres, ctx, true);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

export async function renderTableSlide(
  slide: TableSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;

  applyBackground(pptxSlide, slide, t);
  const isDark = !!slide.darkBackground;
  applyMotifDecorations(pptxSlide, ctx.pres, t, isDark);
  const textColor = getTextColor(slide, t);

  // Title
  pptxSlide.addText(slide.title, {
    x: MARGIN_X, y: TITLE_Y, w: CONTENT_W, h: TITLE_H,
    fontSize: typo.headingSize,
    fontFace: typo.headerFont,
    color: textColor,
    bold: true,
    margin: 0,
  });

  // Build table data
  const headerRow = slide.headers.map(h => ({
    text: h,
    options: {
      fill: { color: t.palette.primary },
      color: isDarkColor(t.palette.primary) ? 'FFFFFF' : t.palette.text,
      bold: true,
      fontSize: typo.bodySize,
      fontFace: typo.headerFont,
    },
  }));

  const altRowColor = isDark ? lightenColor(t.palette.backgroundDark, 8) : 'F8F9FA';
  const mainRowColor = isDark ? t.palette.backgroundDark : t.palette.background;
  const borderColor = isDark ? lightenColor(t.palette.backgroundDark, 18) : 'E2E8F0';

  const dataRows = slide.rows.map((row, rowIdx) =>
    row.map(cell => {
      if (typeof cell === 'string') {
        return {
          text: cell,
          options: {
            fill: { color: rowIdx % 2 === 0 ? altRowColor : mainRowColor },
            color: textColor,
            fontSize: typo.bodySize - 1,
            fontFace: typo.bodyFont,
          },
        };
      }
      return {
        text: cell.text,
        options: {
          fill: { color: cell.fill || (rowIdx % 2 === 0 ? altRowColor : mainRowColor) },
          color: cell.color || textColor,
          bold: cell.bold ?? false,
          fontSize: typo.bodySize - 1,
          fontFace: typo.bodyFont,
          colspan: cell.colspan,
          rowspan: cell.rowspan,
        },
      };
    }),
  );

  const colW = slide.columnWidths
    || Array(slide.headers.length).fill(CONTENT_W / slide.headers.length);

  pptxSlide.addTable([headerRow, ...dataRows], {
    x: MARGIN_X, y: BODY_Y, w: CONTENT_W,
    colW,
    border: { pt: 0.5, color: borderColor },
    autoPage: false,
  });

  addFooter(pptxSlide, ctx.pres, ctx, isDark);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

export async function renderTeamSlide(
  slide: TeamSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;

  applyBackground(pptxSlide, slide, t);
  const isDark = !!slide.darkBackground;
  applyMotifDecorations(pptxSlide, ctx.pres, t, isDark);
  const textColor = getTextColor(slide, t);
  const subColor = getSubTextColor(slide, t);

  // Title
  pptxSlide.addText(slide.title, {
    x: MARGIN_X, y: TITLE_Y, w: CONTENT_W, h: TITLE_H,
    fontSize: typo.headingSize,
    fontFace: typo.headerFont,
    color: textColor,
    bold: true,
    margin: 0,
  });

  const memberCount = slide.members.length;
  const cols = Math.min(memberCount, 4);
  const rows = Math.ceil(memberCount / cols);
  const cellWidth = CONTENT_W / cols;
  const cellHeight = BODY_H / rows;
  const startX = MARGIN_X + 0.1;

  for (let i = 0; i < memberCount; i++) {
    const member = slide.members[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * cellWidth;
    const y = BODY_Y + row * cellHeight;

    // Avatar
    if (member.imageBase64) {
      pptxSlide.addImage({
        data: member.imageBase64,
        x: x + cellWidth / 2 - 0.4, y, w: 0.8, h: 0.8,
        rounding: true,
      });
    } else {
      pptxSlide.addShape(ctx.pres.shapes.OVAL, {
        x: x + cellWidth / 2 - 0.4, y, w: 0.8, h: 0.8,
        fill: { color: lightenColor(t.palette.primary, 30) },
      });
      const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase();
      pptxSlide.addText(initials, {
        x: x + cellWidth / 2 - 0.4, y, w: 0.8, h: 0.8,
        fontSize: 18,
        fontFace: typo.headerFont,
        color: t.palette.primary,
        bold: true,
        align: 'center',
        valign: 'middle',
        margin: 0,
      });
    }

    // Name
    pptxSlide.addText(member.name, {
      x, y: y + 0.9, w: cellWidth, h: 0.4,
      fontSize: typo.bodySize + 1,
      fontFace: typo.headerFont,
      color: textColor,
      bold: true,
      align: 'center',
      margin: 0,
    });

    // Role
    pptxSlide.addText(member.role, {
      x, y: y + 1.25, w: cellWidth, h: 0.3,
      fontSize: typo.captionSize + 1,
      fontFace: typo.bodyFont,
      color: t.palette.primary,
      align: 'center',
      margin: 0,
    });

    // Description
    if (member.description) {
      pptxSlide.addText(member.description, {
        x: x + 0.1, y: y + 1.6, w: cellWidth - 0.2, h: cellHeight - 1.8,
        fontSize: typo.captionSize,
        fontFace: typo.bodyFont,
        color: subColor,
        align: 'center',
        margin: 0,
      });
    }
  }

  addFooter(pptxSlide, ctx.pres, ctx, isDark);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

export async function renderClosingSlide(
  slide: ClosingSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;
  const accentColor = t.palette.accent === 'FFFFFF' ? t.palette.secondary : t.palette.accent;
  const primaryColor = t.palette.primary;

  // Dark background for closing
  pptxSlide.background = { color: t.palette.backgroundDark };

  // ── Decorative shapes (mirror title slide) ──────────────
  // Large translucent circle — top-left
  pptxSlide.addShape(ctx.pres.shapes.OVAL, {
    x: -2.0, y: -2.0, w: 5.0, h: 5.0,
    fill: { color: primaryColor, transparency: 88 },
  });
  // Smaller accent circle — bottom-right
  pptxSlide.addShape(ctx.pres.shapes.OVAL, {
    x: SLIDE_W - 2.5, y: SLIDE_H - 2.0, w: 3.0, h: 3.0,
    fill: { color: accentColor, transparency: 85 },
  });
  // Small circle — top-right
  pptxSlide.addShape(ctx.pres.shapes.OVAL, {
    x: SLIDE_W - 1.5, y: -0.5, w: 1.5, h: 1.5,
    fill: { color: primaryColor, transparency: 90 },
  });

  // Top accent strip
  pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE_W, h: 0.06,
    fill: { color: accentColor },
  });

  // Brand logo if available
  if (ctx.brand?.logoBase64) {
    pptxSlide.addImage({
      data: ctx.brand.logoBase64,
      x: SLIDE_W / 2 - 1.0, y: 0.6, w: 2.0, h: 1.0,
      sizing: { type: 'contain', w: 2.0, h: 1.0 },
    });
  }

  // Main title
  const mainY = ctx.brand?.logoBase64 ? 2.0 : 1.5;
  pptxSlide.addText(slide.title, {
    x: MARGIN_X, y: mainY, w: CONTENT_W, h: 1.2,
    fontSize: typo.titleSize + 4,
    fontFace: typo.headerFont,
    color: t.palette.textOnDark,
    bold: true,
    align: 'center',
    valign: 'middle',
    margin: 0,
  });

  // Accent line under title
  pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
    x: SLIDE_W / 2 - 1.2, y: mainY + 1.25, w: 2.4, h: 0.10,
    fill: { color: accentColor },
    rectRadius: 0.05,
  });

  if (slide.subtitle) {
    pptxSlide.addText(slide.subtitle, {
      x: MARGIN_X, y: mainY + 1.5, w: CONTENT_W, h: 0.6,
      fontSize: typo.subtitleSize + 2,
      fontFace: typo.bodyFont,
      color: lightenColor(t.palette.textOnDark, 25),
      align: 'center',
      margin: 0,
    });
  }

  // Contact info
  if (slide.contactInfo) {
    const contactLines: string[] = [];
    if (slide.contactInfo.email) contactLines.push(slide.contactInfo.email);
    if (slide.contactInfo.website) contactLines.push(slide.contactInfo.website);
    if (slide.contactInfo.phone) contactLines.push(slide.contactInfo.phone);

    if (contactLines.length > 0) {
      pptxSlide.addText(contactLines.join('  \u2022  '), {
        x: MARGIN_X, y: 4.2, w: CONTENT_W, h: 0.5,
        fontSize: typo.captionSize + 1,
        fontFace: typo.bodyFont,
        color: lightenColor(t.palette.textOnDark, 40),
        align: 'center',
        margin: 0,
      });
    }
  }

  addFooter(pptxSlide, ctx.pres, ctx, true);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

export async function renderAgendaSlide(
  slide: AgendaSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;

  applyBackground(pptxSlide, slide, t);
  const isDark = !!slide.darkBackground;
  applyMotifDecorations(pptxSlide, ctx.pres, t, isDark);
  const textColor = getTextColor(slide, t);
  const subColor = getSubTextColor(slide, t);

  // Title
  pptxSlide.addText(slide.title, {
    x: MARGIN_X, y: TITLE_Y, w: CONTENT_W, h: TITLE_H,
    fontSize: typo.headingSize,
    fontFace: typo.headerFont,
    color: textColor,
    bold: true,
    margin: 0,
  });

  const itemHeight = Math.min(0.8, BODY_H / slide.items.length);

  for (let i = 0; i < slide.items.length; i++) {
    const item = slide.items[i];
    const y = BODY_Y + i * itemHeight;

    // Number circle
    pptxSlide.addShape(ctx.pres.shapes.OVAL, {
      x: MARGIN_X, y: y + 0.05, w: 0.45, h: 0.45,
      fill: { color: t.palette.primary },
    });
    pptxSlide.addText(String(i + 1), {
      x: MARGIN_X, y: y + 0.05, w: 0.45, h: 0.45,
      fontSize: 14,
      fontFace: typo.headerFont,
      color: isDarkColor(t.palette.primary) ? 'FFFFFF' : t.palette.text,
      bold: true,
      align: 'center',
      valign: 'middle',
      margin: 0,
    });

    // Item title
    pptxSlide.addText(item.title, {
      x: MARGIN_X + 0.7, y, w: 6.2, h: 0.4,
      fontSize: typo.bodySize + 1,
      fontFace: typo.headerFont,
      color: textColor,
      bold: true,
      margin: 0,
    });

    // Description
    if (item.description) {
      pptxSlide.addText(item.description, {
        x: MARGIN_X + 0.7, y: y + 0.35, w: 6.2, h: 0.3,
        fontSize: typo.captionSize + 1,
        fontFace: typo.bodyFont,
        color: subColor,
        margin: 0,
      });
    }

    // Duration badge
    if (item.duration) {
      pptxSlide.addText(item.duration, {
        x: SLIDE_W - MARGIN_X - 1.2, y: y + 0.05, w: 1.2, h: 0.35,
        fontSize: typo.captionSize,
        fontFace: typo.bodyFont,
        color: t.palette.primary,
        align: 'center',
        valign: 'middle',
        margin: 0,
      });
    }

    // Separator line (not on last item)
    if (i < slide.items.length - 1) {
      pptxSlide.addShape(ctx.pres.shapes.LINE, {
        x: MARGIN_X + 0.7, y: y + itemHeight - 0.05, w: CONTENT_W - 0.7, h: 0,
        line: { color: isDark ? lightenColor(t.palette.backgroundDark, 18) : 'E2E8F0', width: 0.5 },
      });
    }
  }

  addFooter(pptxSlide, ctx.pres, ctx, isDark);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

export async function renderBlankSlide(
  slide: BlankSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  applyBackground(pptxSlide, slide, ctx.theme);
  addFooter(pptxSlide, ctx.pres, ctx, !!slide.darkBackground);
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

// ============================================================
// Full Image Slide (AI or static hero image)
// ============================================================

export async function renderFullImageSlide(
  slide: FullImageSlide,
  ctx: SlideRenderContext,
): Promise<void> {
  const pptxSlide = ctx.pres.addSlide();
  const t = ctx.theme;
  const typo = t.typography!;

  // Dark background as fallback
  pptxSlide.background = { color: t.palette.backgroundDark };

  // Resolve image: AI-generated > provided
  const aiImg = ctx.aiImages?.get(ctx.slideIndex);
  const imgData = aiImg?.base64 || slide.image?.base64;
  const imgUrl = slide.image?.url;

  if (imgData) {
    pptxSlide.addImage({
      data: imgData,
      x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
      sizing: { type: 'cover', w: SLIDE_W, h: SLIDE_H },
    });
  } else if (imgUrl) {
    pptxSlide.addImage({
      path: imgUrl,
      x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
      sizing: { type: 'cover', w: SLIDE_W, h: SLIDE_H },
    });
  }

  // Dark scrim (single rectangle)
  if (slide.scrim !== false && (slide.title || slide.subtitle)) {
    const scrimY = slide.overlayPosition === 'top-left' ? 0
      : slide.overlayPosition === 'center' ? 0
      : SLIDE_H * 0.5;
    const scrimH = slide.overlayPosition === 'center' ? SLIDE_H : SLIDE_H * 0.5;

    pptxSlide.addShape(ctx.pres.shapes.RECTANGLE, {
      x: 0, y: scrimY, w: SLIDE_W, h: scrimH,
      fill: { color: '000000', transparency: 45 },
    });
  }

  // Text overlay
  if (slide.title || slide.subtitle) {
    let textX = MARGIN_X;
    let textY = 3.5;
    let textW = CONTENT_W;
    let align: 'left' | 'center' = 'left';
    let valign: 'top' | 'middle' | 'bottom' = 'bottom';

    switch (slide.overlayPosition) {
      case 'center':
        textY = 1.5;
        align = 'center';
        valign = 'middle';
        break;
      case 'bottom-center':
        textY = 3.5;
        align = 'center';
        break;
      case 'top-left':
        textY = 0.5;
        valign = 'top';
        break;
      case 'bottom-left':
      default:
        break;
    }

    if (slide.title) {
      pptxSlide.addText(slide.title, {
        x: textX, y: textY, w: textW, h: 1.2,
        fontSize: typo.titleSize,
        fontFace: typo.headerFont,
        color: 'FFFFFF',
        bold: true,
        align,
        valign,
        margin: 0,
      });
    }

    if (slide.subtitle) {
      pptxSlide.addText(slide.subtitle, {
        x: textX, y: textY + 1.3, w: textW, h: 0.6,
        fontSize: typo.subtitleSize,
        fontFace: typo.bodyFont,
        color: 'FFFFFFCC',
        align,
        valign: 'top',
        margin: 0,
      });
    }
  }

  // No footer on full-image slides (breaks the bleed)
  addSpeakerNotes(pptxSlide, slide.speakerNotes);
}

// ============================================================
// AI Image Resolution Helper
// ============================================================

export function resolveAiImage(ctx: SlideRenderContext): string | undefined {
  return ctx.aiImages?.get(ctx.slideIndex)?.base64;
}

// ============================================================
// Renderer Dispatch
// ============================================================

export type SlideRenderer = (slide: any, ctx: SlideRenderContext) => Promise<void>;

export const SLIDE_RENDERERS: Record<string, SlideRenderer> = {
  'title': renderTitleSlide,
  'section': renderSectionSlide,
  'content': renderContentSlide,
  'two-column': renderTwoColumnSlide,
  'three-column': renderThreeColumnSlide,
  'bullet-list': renderBulletListSlide,
  'chart-bar': renderChartBarSlide,
  'chart-line': renderChartLineSlide,
  'chart-pie': renderChartPieSlide,
  'chart-doughnut': renderChartDoughnutSlide,
  'comparison': renderComparisonSlide,
  'stat-callout': renderStatCalloutSlide,
  'timeline': renderTimelineSlide,
  'image-text': renderImageTextSlide,
  'icon-grid': renderIconGridSlide,
  'quote': renderQuoteSlide,
  'table': renderTableSlide,
  'team': renderTeamSlide,
  'closing': renderClosingSlide,
  'agenda': renderAgendaSlide,
  'blank': renderBlankSlide,
  'full-image': renderFullImageSlide,
};
