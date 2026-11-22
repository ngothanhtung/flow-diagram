// Width of the Lesson editor's left panel (Narration), which the author can
// drag wider for writing. Clamped so the canvas always keeps most of the
// window; remembered per browser.

export const PANEL_DEFAULT_WIDTH = 320;
export const PANEL_MIN_WIDTH = 260;
/** Never wider than this share of the window, nor than PANEL_MAX_WIDTH. */
const PANEL_MAX_SHARE = 0.6;
const PANEL_MAX_WIDTH = 720;
export const PANEL_WIDTH_KEY = 'xflow:lesson-panel-width';

export function clampPanelWidth(width: number, viewportWidth: number): number {
  if (!Number.isFinite(width)) return PANEL_DEFAULT_WIDTH;
  const max = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, Math.floor(viewportWidth * PANEL_MAX_SHARE)));
  return Math.round(Math.min(Math.max(width, PANEL_MIN_WIDTH), max));
}

/** A stored width, or the default for anything that isn't a positive number. */
export function parseStoredWidth(raw: string | null): number {
  if (!raw || !/^\d+(\.\d+)?$/.test(raw.trim())) return PANEL_DEFAULT_WIDTH;
  const value = Number(raw);
  return value > 0 ? value : PANEL_DEFAULT_WIDTH;
}
