// Coordinate helpers shared by the canvas, palette, and node card.

import type { ViewTransform } from './view-transform';

/**
 * Convert a viewport-space pointer event to the data (logical) coord
 * space used by node positions. The SVG uses a viewBox equal to the
 * container's pixel size and a wrapping <g transform> that maps
 * data → viewBox; this helper walks through both stages.
 */
export function screenToData(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  vt: ViewTransform,
): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  // First: screen → viewBox (1 unit = 1 CSS px given
  // preserveAspectRatio="none" and a viewBox of container size).
  const v = point.matrixTransform(ctm.inverse());
  // Second: viewBox → data by inverting the wrapping transform
  //     data = (viewBox - vt.translate) / vt.scale
  return {
    x: (v.x - vt.x) / vt.scale,
    y: (v.y - vt.y) / vt.scale,
  };
}

/**
 * Inverse of screenToData: convert a data-coord position to a
 * screen-space pixel position, useful when rendering the palette
 * drop preview at the cursor's data location.
 */
export function dataToScreen(
  svg: SVGSVGElement,
  dataX: number,
  dataY: number,
  vt: ViewTransform,
): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: dataX, y: dataY };
  // viewBox = data * scale + translate
  const vx = dataX * vt.scale + vt.x;
  const vy = dataY * vt.scale + vt.y;
  const point = svg.createSVGPoint();
  point.x = vx;
  point.y = vy;
  const s = point.matrixTransform(ctm);
  return { x: s.x, y: s.y };
}
