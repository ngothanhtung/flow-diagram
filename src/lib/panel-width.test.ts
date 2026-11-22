import { describe, expect, it } from 'vitest';
import { PANEL_DEFAULT_WIDTH, PANEL_MIN_WIDTH, clampPanelWidth, parseStoredWidth } from './panel-width';

describe('clampPanelWidth', () => {
  it('keeps a width between the minimum and 60% of the window (at most 720px)', () => {
    expect(clampPanelWidth(100, 1440)).toBe(PANEL_MIN_WIDTH);
    expect(clampPanelWidth(500, 1440)).toBe(500);
    expect(clampPanelWidth(2000, 1440)).toBe(720);
    expect(clampPanelWidth(700, 1000)).toBe(600);
  });

  it('never goes below the minimum, even in a narrow window', () => {
    expect(clampPanelWidth(400, 300)).toBe(PANEL_MIN_WIDTH);
  });

  it('rounds to whole pixels and treats non-numbers as the default', () => {
    expect(clampPanelWidth(400.6, 1440)).toBe(401);
    expect(clampPanelWidth(Number.NaN, 1440)).toBe(PANEL_DEFAULT_WIDTH);
  });
});

describe('parseStoredWidth', () => {
  it('reads a stored number and ignores anything else', () => {
    expect(parseStoredWidth('480')).toBe(480);
    for (const raw of [null, '', 'wide', '-5', '1e9x']) expect(parseStoredWidth(raw)).toBe(PANEL_DEFAULT_WIDTH);
  });
});
