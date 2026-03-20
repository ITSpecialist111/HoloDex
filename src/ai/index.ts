export {
  ImageGenerationManager,
  imageManager,
  getImageManager,
  OpenAIImageProvider,
  AzureOpenAIImageProvider,
  FluxImageProvider,
} from './image-provider.js';
export type {
  ImageSize,
  ImageStyle,
  ImageQuality,
  ImageGenerationRequest,
  GeneratedImage,
  ImageProviderConfig,
  IImageProvider,
} from './image-provider.js';
export {
  generateSlideImagePrompt,
  generateBatchPrompts,
  generateAltText,
} from './prompt-generator.js';
export type { SlideImagePromptOptions } from './prompt-generator.js';
