'use client';

import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { FlowDocumentJSON } from '@/lib/flowchart-types';
import { loadIconLibrary, parseNodeIcon } from '@/lib/icon-library';
import { contentBounds, exportPixelSize, PNG_PIXEL_RATIO, type Box, type ImageBackground, type ImageFormat } from '@/lib/image-export';
import { LEGACY_ICONS, resolveNodeStyle } from '@/lib/node-style';
import { ExportScene } from './ExportScene';
import { flattenSvg } from './flatten-svg';

export class EmptyDiagramError extends Error {
  constructor() {
    super('Diagram is empty');
  }
}

/** The canvas background the current theme paints (`bg-background`). */
export function themeCanvasColor(): string {
  const probe = document.createElement('div');
  probe.className = 'bg-background';
  probe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;';
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  // Normalise oklch()/lab() to sRGB hex through a canvas.
  const context = document.createElement('canvas').getContext('2d')!;
  context.fillStyle = '#000';
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

/** Icons outside the curated set resolve from a lazily loaded library;
 *  load those first so the scene renders every glyph on its first pass. */
async function preloadIcons(doc: FlowDocumentJSON) {
  const libraries = new Set<'lucide' | 'tabler'>();
  for (const node of doc.nodes) {
    const icon = resolveNodeStyle(node).icon;
    if (!icon || icon.startsWith('logo:') || Object.hasOwn(LEGACY_ICONS, icon)) continue;
    libraries.add(parseNodeIcon(icon).library);
  }
  await Promise.all([...libraries].map((library) => loadIconLibrary(library)));
}

export interface RenderedSvg {
  markup: string;
  box: Box;
}

/**
 * The Diagram (or the part of it in `doc`) as a standalone SVG string.
 * Rendered off-screen in a separate React root — never the user's canvas,
 * so the viewport, culling, selection and Replay state can't leak in —
 * then flattened (see `flatten-svg.ts`).
 */
export async function renderDiagramSvg(doc: FlowDocumentJSON, background: ImageBackground): Promise<RenderedSvg> {
  const box = contentBounds(doc);
  if (!box) throw new EmptyDiagramError();
  await preloadIcons(doc);
  await document.fonts.ready;

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:fixed;left:-200000px;top:0;width:${box.width}px;height:${box.height}px;overflow:hidden;pointer-events:none;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<ExportScene document={doc} box={box} background={background === 'theme' ? themeCanvasColor() : null} />));
    const svg = host.querySelector('svg');
    if (!svg) throw new Error('Export render produced no SVG');
    // Layout first, so any face the picture needs starts loading, then wait.
    svg.getBoundingClientRect();
    await document.fonts.ready;
    await flattenSvg(svg);
    const markup = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`;
    return { markup, box };
  } finally {
    root.unmount();
    host.remove();
  }
}

/** Rasterises a flattened SVG at `PNG_PIXEL_RATIO`. Loaded from a `data:`
 *  URL, not a `blob:` one — Chromium taints a canvas that drew an SVG
 *  from a blob URL. */
export async function svgToPng({ markup, box }: RenderedSvg): Promise<Blob> {
  const { width, height } = exportPixelSize(box, 'png');
  const image = new Image();
  image.width = width;
  image.height = height;
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  // An SVG image's embedded fonts can finish decoding a frame after the
  // image itself; one more frame before drawing avoids a fallback-font PNG.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  context.drawImage(image, 0, 0, box.width * PNG_PIXEL_RATIO, box.height * PNG_PIXEL_RATIO);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png'));
}

/** Renders and returns the file for one export. */
export async function exportDiagramImage(doc: FlowDocumentJSON, format: ImageFormat, background: ImageBackground): Promise<Blob> {
  const svg = await renderDiagramSvg(doc, background);
  if (format === 'svg') return new Blob([svg.markup], { type: 'image/svg+xml' });
  return svgToPng(svg);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Revoked on the next task so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
