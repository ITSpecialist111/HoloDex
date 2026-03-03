import React from 'react';
import ReactDOMServer from 'react-dom/server';
import sharp from 'sharp';
import * as FaIcons from 'react-icons/fa';
import * as MdIcons from 'react-icons/md';
import * as HiIcons from 'react-icons/hi';
import * as BiIcons from 'react-icons/bi';
import type { IconRef } from '../schemas.js';
import { logger } from './logger.js';

// Icon library mapping
const iconLibraries: Record<string, Record<string, React.ComponentType<any>>> = {
  fa: FaIcons as any,
  md: MdIcons as any,
  hi: HiIcons as any,
  bi: BiIcons as any,
};

// Cache for rendered icons
const iconCache = new Map<string, string>();

function getCacheKey(icon: IconRef, size: number): string {
  return `${icon.library}:${icon.name}:${icon.color || '000000'}:${size}`;
}

/**
 * Render an icon component to SVG string
 */
function renderIconSvg(
  IconComponent: React.ComponentType<any>,
  color: string = '000000',
  size: number = 256,
): string {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, {
      color: `#${color}`,
      size: String(size),
    }),
  );
}

/**
 * Convert an icon to base64 PNG data string for embedding in PPTX
 */
export async function iconToBase64Png(
  icon: IconRef,
  size: number = 256,
): Promise<string> {
  const cacheKey = getCacheKey(icon, size);

  // Return cached version if available
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  const lib = iconLibraries[icon.library];
  if (!lib) {
    throw new Error(`Unknown icon library: ${icon.library}`);
  }

  const IconComponent = lib[icon.name];
  if (!IconComponent) {
    // Try common naming patterns
    const altNames = [
      icon.name,
      `Fa${icon.name}`,
      `Md${icon.name}`,
      `Hi${icon.name}`,
      `Bi${icon.name}`,
    ];

    for (const name of altNames) {
      if (lib[name]) {
        const svg = renderIconSvg(lib[name], icon.color || '000000', size);
        const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
        const result = 'image/png;base64,' + pngBuffer.toString('base64');
        iconCache.set(cacheKey, result);
        return result;
      }
    }

    logger.warn(`Icon not found: ${icon.library}/${icon.name}, using fallback`);
    return await generateFallbackIcon(icon.color || '000000', size);
  }

  const svg = renderIconSvg(IconComponent, icon.color || '000000', size);
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  const result = 'image/png;base64,' + pngBuffer.toString('base64');

  iconCache.set(cacheKey, result);
  return result;
}

/**
 * Generate a simple circle fallback icon when the requested icon isn't found
 */
async function generateFallbackIcon(color: string, size: number): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 4}" fill="#${color}" opacity="0.2"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 4}" fill="#${color}"/>
  </svg>`;

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + pngBuffer.toString('base64');
}

/**
 * Generate a colored circle background for an icon (icon-in-circle motif)
 */
export async function generateIconCircle(
  bgColor: string,
  size: number = 256,
): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#${bgColor}"/>
  </svg>`;

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + pngBuffer.toString('base64');
}

/**
 * List available icons in a library
 */
export function listAvailableIcons(library: string): string[] {
  const lib = iconLibraries[library];
  if (!lib) return [];
  return Object.keys(lib).filter(key => typeof lib[key] === 'function');
}

/**
 * Clear the icon cache
 */
export function clearIconCache(): void {
  iconCache.clear();
}
