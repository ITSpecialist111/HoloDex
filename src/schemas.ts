import { z } from 'zod';

// ============================================================
// Color & Design Schemas
// ============================================================

export const HexColorSchema = z.string()
  .regex(/^[0-9A-Fa-f]{6}$/, 'Must be 6-char hex without # prefix');

export const ColorPaletteSchema = z.object({
  primary: HexColorSchema,
  secondary: HexColorSchema,
  accent: HexColorSchema,
  background: HexColorSchema.default('FFFFFF'),
  backgroundDark: HexColorSchema.default('1E1E2E'),
  text: HexColorSchema.default('1E293B'),
  textLight: HexColorSchema.default('64748B'),
  textOnDark: HexColorSchema.default('FFFFFF'),
  success: HexColorSchema.optional(),
  warning: HexColorSchema.optional(),
  error: HexColorSchema.optional(),
});

export const TypographySchema = z.object({
  headerFont: z.string().default('Century Gothic'),
  bodyFont: z.string().default('Calibri'),
  titleSize: z.number().min(20).max(60).default(40),
  subtitleSize: z.number().min(14).max(36).default(22),
  headingSize: z.number().min(18).max(36).default(24),
  bodySize: z.number().min(10).max(24).default(14),
  captionSize: z.number().min(8).max(16).default(11),
  /** Font used for pull-quote slides */
  quoteFont: z.string().default('Georgia'),
});

export const DesignThemeSchema = z.object({
  name: z.string().optional(),
  palette: ColorPaletteSchema,
  typography: TypographySchema.optional(),
  visualMotif: z.enum([
    'icons-in-circles',
    'accent-borders',
    'rounded-cards',
    'sharp-geometric',
    'minimal-lines',
    'gradient-headers',
  ]).optional(),
  slideLayout: z.enum(['LAYOUT_16x9', 'LAYOUT_16x10', 'LAYOUT_4x3', 'LAYOUT_WIDE']).default('LAYOUT_16x9'),
});

/** Input variant where palette is optional (resolved by paletteName or defaults) */
export const DesignThemeInputSchema = DesignThemeSchema.extend({
  palette: ColorPaletteSchema.optional(),
});

// ============================================================
// Brand Schemas
// ============================================================

export const BrandConfigSchema = z.object({
  companyName: z.string(),
  tagline: z.string().optional(),
  logoBase64: z.string().optional(),
  logoUrl: z.string().url().optional(),
  palette: ColorPaletteSchema,
  typography: TypographySchema.optional(),
  toneOfVoice: z.enum(['formal', 'friendly', 'technical', 'creative', 'authoritative']).default('formal'),
  visualMotif: z.enum([
    'icons-in-circles',
    'accent-borders',
    'rounded-cards',
    'sharp-geometric',
    'minimal-lines',
    'gradient-headers',
  ]).optional(),
  masterTemplateBase64: z.string().optional(),
  masterTemplateUrl: z.string().url().optional(),
});

// ============================================================
// Content Schemas
// ============================================================

export const SpeakerNotesSchema = z.string().optional();

// ============================================================
// AI Image Generation Schemas
// ============================================================

export const AiImageRequestSchema = z.object({
  /** Prompt describing the desired image; auto-generated from slide context when omitted */
  prompt: z.string().optional(),
  /** Image size */
  size: z.enum(['1024x1024', '1792x1024', '1024x1792', '512x512', '256x256']).optional(),
  /** Image style: natural (photorealistic) or vivid (dramatic/hyper-real) */
  style: z.enum(['natural', 'vivid']).optional(),
  /** Quality tier */
  quality: z.enum(['standard', 'high', 'hd', 'low', 'medium', 'auto']).optional(),
  /** Where to place the generated image on the slide */
  placement: z.enum(['background', 'inline', 'left', 'right', 'full']).default('inline'),
  /** Additional style instructions appended to the prompt */
  styleNotes: z.string().optional(),
});

export const AiImageSettingsSchema = z.object({
  /** Enable AI image generation for this request (default false) */
  enabled: z.boolean().default(false),
  /** Provider override: openai | azure-openai */
  provider: z.enum(['openai', 'azure-openai']).optional(),
  /** Model override (e.g. 'dall-e-3', 'gpt-image-1') */
  model: z.string().optional(),
  /** Default style for all generated images */
  defaultStyle: z.enum(['natural', 'vivid']).optional(),
  /** Default quality for all generated images */
  defaultQuality: z.enum(['standard', 'high', 'hd', 'low', 'medium', 'auto']).optional(),
});

export const ChartDataPointSchema = z.object({
  label: z.string(),
  value: z.number(),
});

export const ChartSeriesSchema = z.object({
  name: z.string(),
  labels: z.array(z.string()),
  values: z.array(z.number()),
});

export const TableCellSchema = z.object({
  text: z.string(),
  bold: z.boolean().optional(),
  fill: HexColorSchema.optional(),
  color: HexColorSchema.optional(),
  colspan: z.number().optional(),
  rowspan: z.number().optional(),
});

export const TableRowSchema = z.array(z.union([z.string(), TableCellSchema]));

export const IconRefSchema = z.object({
  library: z.enum(['fa', 'md', 'hi', 'bi']).default('fa'),
  name: z.string(),
  color: HexColorSchema.optional(),
});

export const ImageRefSchema = z.object({
  url: z.string().optional(),
  base64: z.string().optional(),
  path: z.string().optional(),
  altText: z.string().optional(),
});

// ============================================================
// Slide Type Schemas
// ============================================================

export const SlideType = z.enum([
  'title',
  'section',
  'content',
  'two-column',
  'three-column',
  'bullet-list',
  'chart-bar',
  'chart-line',
  'chart-pie',
  'chart-doughnut',
  'comparison',
  'stat-callout',
  'timeline',
  'image-text',
  'icon-grid',
  'quote',
  'table',
  'team',
  'closing',
  'agenda',
  'blank',
  'full-image',
]);

export const BaseSlideSchema = z.object({
  type: SlideType,
  speakerNotes: SpeakerNotesSchema,
  backgroundOverride: z.union([HexColorSchema, ImageRefSchema]).optional(),
  darkBackground: z.boolean().optional(),
  /** AI-generated image configuration — when present, an image is generated for this slide */
  aiImage: AiImageRequestSchema.optional(),
});

export const TitleSlideSchema = BaseSlideSchema.extend({
  type: z.literal('title'),
  title: z.string(),
  subtitle: z.string().optional(),
  author: z.string().optional(),
  date: z.string().optional(),
});

export const SectionSlideSchema = BaseSlideSchema.extend({
  type: z.literal('section'),
  title: z.string(),
  subtitle: z.string().optional(),
  sectionNumber: z.number().optional(),
});

export const ContentSlideSchema = BaseSlideSchema.extend({
  type: z.literal('content'),
  title: z.string(),
  body: z.string().default(''),
  image: ImageRefSchema.optional(),
  icon: IconRefSchema.optional(),
});

export const TwoColumnSlideSchema = BaseSlideSchema.extend({
  type: z.literal('two-column'),
  title: z.string(),
  leftTitle: z.string().optional(),
  leftContent: z.string().default(''),
  rightTitle: z.string().optional(),
  rightContent: z.string().default(''),
  leftIcon: IconRefSchema.optional(),
  rightIcon: IconRefSchema.optional(),
});

export const ThreeColumnSlideSchema = BaseSlideSchema.extend({
  type: z.literal('three-column'),
  title: z.string(),
  columns: z.array(z.object({
    title: z.string().optional(),
    content: z.string().default(''),
    icon: IconRefSchema.optional(),
  })).min(1).max(3).default([{ content: '' }, { content: '' }, { content: '' }]),
});

export const BulletListSlideSchema = BaseSlideSchema.extend({
  type: z.literal('bullet-list'),
  title: z.string(),
  items: z.array(z.object({
    text: z.string(),
    subItems: z.array(z.string()).optional(),
    icon: IconRefSchema.optional(),
  })).default([]),
});

export const ChartBarSlideSchema = BaseSlideSchema.extend({
  type: z.literal('chart-bar'),
  title: z.string(),
  series: z.array(ChartSeriesSchema).default([]),
  commentary: z.string().optional(),
  horizontal: z.boolean().optional(),
  stacked: z.boolean().optional(),
});

export const ChartLineSlideSchema = BaseSlideSchema.extend({
  type: z.literal('chart-line'),
  title: z.string(),
  series: z.array(ChartSeriesSchema).default([]),
  commentary: z.string().optional(),
  smooth: z.boolean().optional(),
});

export const ChartPieSlideSchema = BaseSlideSchema.extend({
  type: z.literal('chart-pie'),
  title: z.string(),
  series: z.array(ChartSeriesSchema).default([]),
  commentary: z.string().optional(),
  showPercent: z.boolean().default(true),
});

export const ChartDoughnutSlideSchema = BaseSlideSchema.extend({
  type: z.literal('chart-doughnut'),
  title: z.string(),
  series: z.array(ChartSeriesSchema).default([]),
  commentary: z.string().optional(),
  showPercent: z.boolean().default(true),
});

export const ComparisonSlideSchema = BaseSlideSchema.extend({
  type: z.literal('comparison'),
  title: z.string(),
  leftTitle: z.string().default(''),
  leftItems: z.array(z.string()).default([]),
  rightTitle: z.string().default(''),
  rightItems: z.array(z.string()).default([]),
  leftColor: HexColorSchema.optional(),
  rightColor: HexColorSchema.optional(),
});

export const StatCalloutSlideSchema = BaseSlideSchema.extend({
  type: z.literal('stat-callout'),
  title: z.string().optional(),
  stats: z.array(z.object({
    value: z.string(),
    label: z.string(),
    icon: IconRefSchema.optional(),
  })).max(4).default([]),
});

export const TimelineSlideSchema = BaseSlideSchema.extend({
  type: z.literal('timeline'),
  title: z.string(),
  steps: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    icon: IconRefSchema.optional(),
  })).max(6).default([]),
});

export const ImageTextSlideSchema = BaseSlideSchema.extend({
  type: z.literal('image-text'),
  title: z.string(),
  body: z.string().default(''),
  /** Image reference — optional when aiImage is provided */
  image: ImageRefSchema.optional(),
  imagePosition: z.enum(['left', 'right']).default('right'),
});

export const IconGridSlideSchema = BaseSlideSchema.extend({
  type: z.literal('icon-grid'),
  title: z.string(),
  items: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    icon: IconRefSchema,
  })).max(6).default([]),
});

export const QuoteSlideSchema = BaseSlideSchema.extend({
  type: z.literal('quote'),
  quote: z.string(),
  attribution: z.string().optional(),
  role: z.string().optional(),
});

export const TableSlideSchema = BaseSlideSchema.extend({
  type: z.literal('table'),
  title: z.string(),
  headers: z.array(z.string()).default([]),
  rows: z.array(TableRowSchema).default([]),
  columnWidths: z.array(z.number()).optional(),
});

export const TeamMemberSchema = z.object({
  name: z.string(),
  role: z.string(),
  description: z.string().optional(),
  imageBase64: z.string().optional(),
  imageUrl: z.string().optional(),
});

export const TeamSlideSchema = BaseSlideSchema.extend({
  type: z.literal('team'),
  title: z.string(),
  members: z.array(TeamMemberSchema).max(6).default([]),
});

export const ClosingSlideSchema = BaseSlideSchema.extend({
  type: z.literal('closing'),
  title: z.string().default('Thank You'),
  subtitle: z.string().optional(),
  contactInfo: z.object({
    email: z.string().optional(),
    website: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
});

export const AgendaSlideSchema = BaseSlideSchema.extend({
  type: z.literal('agenda'),
  title: z.string().default('Agenda'),
  items: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    duration: z.string().optional(),
  })).default([]),
});

export const BlankSlideSchema = BaseSlideSchema.extend({
  type: z.literal('blank'),
  elements: z.array(z.object({
    type: z.enum(['text', 'shape', 'image', 'chart']),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    props: z.record(z.unknown()).optional(),
  })).optional(),
});

export const FullImageSlideSchema = BaseSlideSchema.extend({
  type: z.literal('full-image'),
  /** Title overlay on the image (optional) */
  title: z.string().optional(),
  /** Subtitle overlay (optional) */
  subtitle: z.string().optional(),
  /** Image reference (used when not AI-generated) */
  image: ImageRefSchema.optional(),
  /** Text overlay position */
  overlayPosition: z.enum(['bottom-left', 'center', 'bottom-center', 'top-left']).default('bottom-left'),
  /** Dark scrim over image for text legibility */
  scrim: z.boolean().default(true),
});

// Union of all slide types
export const SlideSchema = z.discriminatedUnion('type', [
  TitleSlideSchema,
  SectionSlideSchema,
  ContentSlideSchema,
  TwoColumnSlideSchema,
  ThreeColumnSlideSchema,
  BulletListSlideSchema,
  ChartBarSlideSchema,
  ChartLineSlideSchema,
  ChartPieSlideSchema,
  ChartDoughnutSlideSchema,
  ComparisonSlideSchema,
  StatCalloutSlideSchema,
  TimelineSlideSchema,
  ImageTextSlideSchema,
  IconGridSlideSchema,
  QuoteSlideSchema,
  TableSlideSchema,
  TeamSlideSchema,
  ClosingSlideSchema,
  AgendaSlideSchema,
  BlankSlideSchema,
  FullImageSlideSchema,
]);

// ============================================================
// Presentation Request Schema
// ============================================================

export const PresentationRequestSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  author: z.string().optional(),
  slides: z.array(SlideSchema).min(1).max(50),
  theme: DesignThemeInputSchema.optional(),
  paletteName: z.string().optional().describe('Preset palette name (use list_palettes to see options). Overrides theme.palette if both provided.'),
  brand: BrandConfigSchema.optional(),
  outputFormat: z.enum(['buffer', 'base64', 'file', 'blob-url']).default('buffer'),
  outputFileName: z.string().optional(),
  /** AI image generation settings for this request */
  aiImageSettings: AiImageSettingsSchema.optional(),
});

// ============================================================
// TypeScript Types (inferred from Zod)
// ============================================================

export type HexColor = z.infer<typeof HexColorSchema>;
export type ColorPalette = z.infer<typeof ColorPaletteSchema>;
export type Typography = z.infer<typeof TypographySchema>;
export type DesignTheme = z.infer<typeof DesignThemeSchema>;
export type BrandConfig = z.infer<typeof BrandConfigSchema>;
export type ChartSeries = z.infer<typeof ChartSeriesSchema>;
export type TableCell = z.infer<typeof TableCellSchema>;
export type IconRef = z.infer<typeof IconRefSchema>;
export type ImageRef = z.infer<typeof ImageRefSchema>;
export type SlideTypeEnum = z.infer<typeof SlideType>;

export type TitleSlide = z.infer<typeof TitleSlideSchema>;
export type SectionSlide = z.infer<typeof SectionSlideSchema>;
export type ContentSlide = z.infer<typeof ContentSlideSchema>;
export type TwoColumnSlide = z.infer<typeof TwoColumnSlideSchema>;
export type ThreeColumnSlide = z.infer<typeof ThreeColumnSlideSchema>;
export type BulletListSlide = z.infer<typeof BulletListSlideSchema>;
export type ChartBarSlide = z.infer<typeof ChartBarSlideSchema>;
export type ChartLineSlide = z.infer<typeof ChartLineSlideSchema>;
export type ChartPieSlide = z.infer<typeof ChartPieSlideSchema>;
export type ChartDoughnutSlide = z.infer<typeof ChartDoughnutSlideSchema>;
export type ComparisonSlide = z.infer<typeof ComparisonSlideSchema>;
export type StatCalloutSlide = z.infer<typeof StatCalloutSlideSchema>;
export type TimelineSlide = z.infer<typeof TimelineSlideSchema>;
export type ImageTextSlide = z.infer<typeof ImageTextSlideSchema>;
export type IconGridSlide = z.infer<typeof IconGridSlideSchema>;
export type QuoteSlide = z.infer<typeof QuoteSlideSchema>;
export type TableSlide = z.infer<typeof TableSlideSchema>;
export type TeamSlide = z.infer<typeof TeamSlideSchema>;
export type ClosingSlide = z.infer<typeof ClosingSlideSchema>;
export type AgendaSlide = z.infer<typeof AgendaSlideSchema>;
export type BlankSlide = z.infer<typeof BlankSlideSchema>;
export type FullImageSlide = z.infer<typeof FullImageSlideSchema>;
export type AiImageRequest = z.infer<typeof AiImageRequestSchema>;
export type AiImageSettings = z.infer<typeof AiImageSettingsSchema>;

export type Slide = z.infer<typeof SlideSchema>;
export type PresentationRequest = z.infer<typeof PresentationRequestSchema>;

// ============================================================
// Result Types
// ============================================================

export interface PresentationResult {
  success: boolean;
  fileName: string;
  slideCount: number;
  buffer?: Buffer;
  base64?: string;
  filePath?: string;
  blobUrl?: string;
  errors?: string[];
  warnings?: string[];
}

export interface SlideRenderContext {
  pres: any; // PptxGenJS instance
  theme: DesignTheme;
  brand?: BrandConfig;
  slideIndex: number;
  totalSlides: number;
  iconCache: Map<string, string>; // cached icon base64
  /** AI-generated images keyed by slide index */
  aiImages?: Map<number, { base64: string; revisedPrompt?: string }>;
}

// ============================================================
// Preset Color Palettes
// ============================================================

export const PRESET_PALETTES: Record<string, ColorPalette> = {
  'midnight-executive': {
    primary: '1E2761',
    secondary: 'CADCFC',
    accent: 'FFFFFF',
    background: 'F8F9FC',
    backgroundDark: '1E2761',
    text: '0F1629',
    textLight: '4A5568',
    textOnDark: 'FFFFFF',
  },
  'forest-moss': {
    primary: '2C5F2D',
    secondary: '97BC62',
    accent: 'F5F5F5',
    background: 'FAFDF7',
    backgroundDark: '1A3B1B',
    text: '1A2E1B',
    textLight: '4D6B4E',
    textOnDark: 'F0F7EC',
  },
  'coral-energy': {
    primary: 'F96167',
    secondary: 'F9E795',
    accent: '2F3C7E',
    background: 'FFFAF9',
    backgroundDark: '2F3C7E',
    text: '2D1B1E',
    textLight: '7A5A5E',
    textOnDark: 'FFF5F5',
  },
  'warm-terracotta': {
    primary: 'B85042',
    secondary: 'E7E8D1',
    accent: 'A7BEAE',
    background: 'FBF9F4',
    backgroundDark: '8C3A2F',
    text: '3B1F19',
    textLight: '7A6054',
    textOnDark: 'FDF5F0',
  },
  'ocean-gradient': {
    primary: '065A82',
    secondary: '1C7293',
    accent: '21295C',
    background: 'F5FAFD',
    backgroundDark: '152038',
    text: '0D2137',
    textLight: '4A6E85',
    textOnDark: 'EAF4FB',
  },
  'charcoal-minimal': {
    primary: '36454F',
    secondary: 'E8ECEF',
    accent: '212121',
    background: 'FFFFFF',
    backgroundDark: '2A353D',
    text: '1A2028',
    textLight: '5C6975',
    textOnDark: 'EFF2F5',
  },
  'teal-trust': {
    primary: '028090',
    secondary: '00A896',
    accent: '02C39A',
    background: 'F4FCFB',
    backgroundDark: '015965',
    text: '0B2E33',
    textLight: '4A7A80',
    textOnDark: 'E6FAF7',
  },
  'berry-cream': {
    primary: '6D2E46',
    secondary: 'A26769',
    accent: 'ECE2D0',
    background: 'FDF8F5',
    backgroundDark: '4E1F31',
    text: '2E1520',
    textLight: '7A5563',
    textOnDark: 'F8ECE4',
  },
  'sage-calm': {
    primary: '84B59F',
    secondary: '69A297',
    accent: '50808E',
    background: 'F6FBF9',
    backgroundDark: '3A5E51',
    text: '1E3329',
    textLight: '5A7B6E',
    textOnDark: 'EDF7F3',
  },
  'cherry-bold': {
    primary: '990011',
    secondary: 'FCF6F5',
    accent: '2F3C7E',
    background: 'FFFBFB',
    backgroundDark: '6E000C',
    text: '2B0008',
    textLight: '854048',
    textOnDark: 'FDECED',
  },
};
