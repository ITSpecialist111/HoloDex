/**
 * AI Image Prompt Generator
 * 
 * Generates optimized image prompts from slide context, theme colors,
 * and presentation metadata. Ensures generated images are cohesive
 * with the overall presentation design.
 */

import type { DesignTheme, Slide } from '../schemas.js';
import type { ImageGenerationRequest, ImageSize } from './image-provider.js';

// ============================================================
// Prompt Templates by Slide Context
// ============================================================

const STYLE_MODIFIERS: Record<string, string> = {
  'icons-in-circles': 'clean modern design with circular iconographic elements',
  'accent-borders': 'clean professional design with strong geometric borders',
  'rounded-cards': 'soft rounded approachable design aesthetic',
  'sharp-geometric': 'bold sharp angular geometric design',
  'minimal-lines': 'ultra-minimal clean design with thin line art',
  'gradient-headers': 'smooth gradient color transitions in modern style',
};

const TONE_MODIFIERS: Record<string, string> = {
  formal: 'corporate professional polished',
  friendly: 'warm approachable inviting',
  technical: 'technical precise data-driven',
  creative: 'bold creative artistic',
  authoritative: 'authoritative commanding powerful',
};

/**
 * Slide-type specific prompt enhancement strategies
 */
const SLIDE_PROMPT_HINTS: Record<string, string> = {
  'title': 'abstract background, hero image, keynote opening, dramatic',
  'section': 'abstract transitional, section divider, atmospheric',
  'content': 'supporting illustration, conceptual, business context',
  'two-column': 'comparison visual, two concepts side by side',
  'three-column': 'three related concepts, triptych composition',
  'comparison': 'contrast visual, pros and cons, duality',
  'stat-callout': 'data visualization backdrop, metrics, abstract numbers',
  'timeline': 'progression, journey, evolution, left-to-right flow',
  'image-text': 'high-quality photograph or illustration, editorial style',
  'quote': 'inspirational backdrop, atmospheric, mood setting',
  'closing': 'concluding visual, sunset metaphor, elegant wrap-up',
  'team': 'team collaboration, office environment, professional portraits backdrop',
  'agenda': 'organized structure, roadmap visual, clean overview',
};

// ============================================================
// Core Prompt Generator
// ============================================================

export interface SlideImagePromptOptions {
  /** The slide requesting the image */
  slide: Slide;
  /** Slide index in presentation */
  slideIndex: number;
  /** Total slides */
  totalSlides: number;
  /** Active design theme */
  theme: DesignTheme;
  /** The overall presentation title */
  presentationTitle: string;
  /** User-provided prompt (overrides auto-generation) */
  userPrompt?: string;
  /** Target image size for the slide layout */
  targetSize?: ImageSize;
  /** Whether image will be used as background (affects style) */
  asBackground?: boolean;
  /** Additional style instructions */
  styleNotes?: string;
}

/**
 * Generate an optimized image prompt for a slide.
 * If the user provided a prompt, it's enhanced with theme/style context.
 * If no prompt given, one is auto-generated from slide content.
 */
export function generateSlideImagePrompt(options: SlideImagePromptOptions): ImageGenerationRequest {
  const {
    slide,
    theme,
    presentationTitle,
    userPrompt,
    targetSize,
    asBackground,
    styleNotes,
  } = options;

  const palette = theme.palette;
  const motif = theme.visualMotif;

  // Extract slide text for context
  const slideTitle = extractSlideTitle(slide);
  const slideBody = extractSlideBody(slide);

  // Build the prompt
  let prompt: string;

  if (userPrompt) {
    // User provided a prompt — enhance it with style guidance
    prompt = enhanceUserPrompt(userPrompt, {
      palette,
      motif,
      asBackground,
      styleNotes,
    });
  } else {
    // Auto-generate from slide content
    prompt = autoGeneratePrompt({
      slideType: slide.type,
      slideTitle,
      slideBody,
      presentationTitle,
      palette,
      motif,
      asBackground,
      styleNotes,
    });
  }

  // Determine optimal size based on usage
  const size = targetSize || getOptimalSize(slide.type, asBackground);

  return {
    prompt,
    size,
    style: asBackground ? 'natural' : 'vivid',
    quality: 'auto',
    n: 1,
    context: {
      slideTitle,
      slideType: slide.type,
      presentationTitle,
      palette: {
        primary: palette.primary,
        secondary: palette.secondary,
        accent: palette.accent,
      },
    },
  };
}

/**
 * Generate prompts for all slides that need AI images in a presentation.
 */
export function generateBatchPrompts(
  slides: Slide[],
  theme: DesignTheme,
  presentationTitle: string,
): { slideIndex: number; request: ImageGenerationRequest }[] {
  const results: { slideIndex: number; request: ImageGenerationRequest }[] = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i] as any;
    const aiImage = slide.aiImage;

    if (!aiImage) continue;

    const request = generateSlideImagePrompt({
      slide,
      slideIndex: i,
      totalSlides: slides.length,
      theme,
      presentationTitle,
      userPrompt: aiImage.prompt,
      targetSize: aiImage.size,
      asBackground: aiImage.placement === 'background',
      styleNotes: aiImage.styleNotes,
    });

    results.push({ slideIndex: i, request });
  }

  return results;
}

// ============================================================
// Internal Helpers
// ============================================================

function enhanceUserPrompt(
  userPrompt: string,
  context: {
    palette: DesignTheme['palette'];
    motif?: string;
    asBackground?: boolean;
    styleNotes?: string;
  },
): string {
  const parts: string[] = [userPrompt];

  // Add style guidance
  if (context.motif && STYLE_MODIFIERS[context.motif]) {
    parts.push(STYLE_MODIFIERS[context.motif]);
  }

  // Color harmony guidance
  parts.push(
    `Color palette: use tones harmonious with #${context.palette.primary} (primary) and #${context.palette.accent} (accent).`
  );

  // Background-specific instructions
  if (context.asBackground) {
    parts.push(
      'This will be used as a slide background. Leave generous negative space for text overlay. Avoid text in the image. Keep it subtle and atmospheric.'
    );
  }

  if (context.styleNotes) {
    parts.push(context.styleNotes);
  }

  // Universal quality guidance
  parts.push('Professional quality, suitable for a business presentation. No text, watermarks, or logos in the image.');

  return parts.join('. ');
}

function autoGeneratePrompt(context: {
  slideType: string;
  slideTitle: string;
  slideBody: string;
  presentationTitle: string;
  palette: DesignTheme['palette'];
  motif?: string;
  asBackground?: boolean;
  styleNotes?: string;
}): string {
  const parts: string[] = [];

  // Start with slide-type specific hint
  const typeHint = SLIDE_PROMPT_HINTS[context.slideType];
  if (typeHint) {
    parts.push(`Create an image for a presentation slide: ${typeHint}`);
  } else {
    parts.push('Create a professional image for a presentation slide');
  }

  // Add content context
  if (context.slideTitle) {
    parts.push(`The slide is titled "${context.slideTitle}"`);
  }

  // Add condensed body context (first 200 chars)
  if (context.slideBody) {
    const condensed = context.slideBody.substring(0, 200).replace(/\n/g, ' ');
    parts.push(`Context: ${condensed}`);
  }

  // Presentation-level context
  parts.push(`From a presentation called "${context.presentationTitle}"`);

  // Design style
  if (context.motif && STYLE_MODIFIERS[context.motif]) {
    parts.push(`Design style: ${STYLE_MODIFIERS[context.motif]}`);
  }

  // Color guidance
  parts.push(
    `Use a color palette harmonious with #${context.palette.primary} (primary) and #${context.palette.accent} (accent)`
  );

  // Background vs inline
  if (context.asBackground) {
    parts.push(
      'This is a slide BACKGROUND image: use subtle, atmospheric composition with large areas of negative space for text overlay. No text in the image.'
    );
  } else {
    parts.push('Professional, clean composition. No text, watermarks, or logos in the image.');
  }

  if (context.styleNotes) {
    parts.push(context.styleNotes);
  }

  return parts.join('. ') + '.';
}

function extractSlideTitle(slide: Slide): string {
  if ('title' in slide && typeof slide.title === 'string') {
    return slide.title;
  }
  return '';
}

function extractSlideBody(slide: Slide): string {
  const s = slide as any;
  if (s.body) return s.body;
  if (s.quote) return s.quote;
  if (s.subtitle) return s.subtitle;
  if (s.items) {
    const items = Array.isArray(s.items) ? s.items : [];
    return items.map((item: any) => typeof item === 'string' ? item : (item.text || item.title || '')).join(', ');
  }
  if (s.leftContent && s.rightContent) return `${s.leftContent} vs ${s.rightContent}`;
  return '';
}

function getOptimalSize(slideType: string, asBackground?: boolean): ImageSize {
  // Backgrounds should be wide (16:9 ratio approximation)
  if (asBackground) return '1792x1024';

  // Specific slide types benefit from different aspect ratios
  switch (slideType) {
    case 'title':
    case 'section':
    case 'closing':
    case 'full-image':
      return '1792x1024'; // Wide for full-bleed
    case 'image-text':
      return '1024x1024'; // Square for half-slide
    case 'team':
      return '1024x1024'; // Square for portraits
    default:
      return '1792x1024'; // Default wide
  }
}

/**
 * Generate a simple image description for alt text / accessibility.
 */
export function generateAltText(prompt: string, revisedPrompt?: string): string {
  const source = revisedPrompt || prompt;
  // Truncate to ~125 chars for accessibility best practice
  if (source.length <= 125) return source;
  return source.substring(0, 122) + '...';
}
