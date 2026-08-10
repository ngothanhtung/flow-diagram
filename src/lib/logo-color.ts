// Extract the dominant colour from an SVG logo and map it to the closest
// node colour preset. Runs entirely in the browser so the result matches
// whatever logo asset is currently served under /logos/{slug}.svg.

import { COLORS, type NodeColor } from './node-style';

const SAMPLE_SIZE = 128;

interface RGB {
  r: number;
  g: number;
  b: number;
}

function loadLogoImage(slug: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load logo ${slug}`));
    img.src = `/logos/${slug}.svg`;
  });
}

function quantizeChannel(value: number, bits: number): number {
  const max = 2 ** bits - 1;
  return Math.round((value / 255) * max) * Math.floor(255 / max);
}

function dominantColor(image: HTMLImageElement): RGB | null {
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Draw the SVG into a square, letter-boxing it so the colour sampling
  // is not distorted by non-uniform stretching.
  const scale = Math.min(SAMPLE_SIZE / image.width, SAMPLE_SIZE / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  const dx = (SAMPLE_SIZE - dw) / 2;
  const dy = (SAMPLE_SIZE - dh) / 2;
  ctx.drawImage(image, dx, dy, dw, dh);

  const data = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
  const bins = new Map<string, { count: number; sumR: number; sumG: number; sumB: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 128) continue;
    const luminance = r + g + b;
    // Ignore near-white, near-black, and very grey pixels so transparent
    // backgrounds and thin strokes do not dominate the result.
    if (luminance > 720 || luminance < 30) continue;
    if (Math.max(r, g, b) - Math.min(r, g, b) < 16) continue;

    const qr = quantizeChannel(r, 4);
    const qg = quantizeChannel(g, 4);
    const qb = quantizeChannel(b, 4);
    const key = `${qr},${qg},${qb}`;
    const existing = bins.get(key);
    if (existing) {
      existing.count += 1;
      existing.sumR += r;
      existing.sumG += g;
      existing.sumB += b;
    } else {
      bins.set(key, { count: 1, sumR: r, sumG: g, sumB: b });
    }
  }

  let best: { count: number; sumR: number; sumG: number; sumB: number } | null = null;
  for (const bin of bins.values()) {
    if (!best || bin.count > best.count) {
      best = bin;
    }
  }

  if (!best || best.count < 10) return null;
  return {
    r: Math.round(best.sumR / best.count),
    g: Math.round(best.sumG / best.count),
    b: Math.round(best.sumB / best.count),
  };
}

function colorDistance(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function hexToRgb(hex: string): RGB {
  const normalized = hex.replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

/**
 * Load the logo SVG and return the closest matching node colour preset.
 * Returns `null` if the image cannot be loaded or no dominant colour is found.
 */
export async function resolveClosestLogoColor(slug: string): Promise<NodeColor | null> {
  const img = await loadLogoImage(slug);
  const color = dominantColor(img);
  if (!color) return null;

  const presets = Object.keys(COLORS) as NodeColor[];
  let best: NodeColor | null = null;
  let bestDistance = Infinity;
  for (const key of presets) {
    const presetRgb = hexToRgb(COLORS[key].foreground);
    const distance = colorDistance(color, presetRgb);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = key;
    }
  }
  return best;
}
