import type { NodeFont } from './flowchart-types';

export const NODE_FONT_OPTIONS: ReadonlyArray<{
  value: NodeFont;
  label: string;
  character: string;
}> = [
  { value: 'geist-mono', label: 'Geist Mono', character: 'Technical' },
  { value: 'be-vietnam-pro', label: 'Be Vietnam Pro', character: 'Modern' },
  { value: 'noto-sans', label: 'Noto Sans', character: 'Readable' },
  { value: 'source-sans-3', label: 'Source Sans 3', character: 'Clean' },
  { value: 'roboto-slab', label: 'Roboto Slab', character: 'Structural' },
  { value: 'merriweather', label: 'Merriweather', character: 'Formal' },
];

export const NODE_FONT_FAMILIES: Record<NodeFont, string> = {
  'geist-mono': 'var(--font-geist-mono), ui-monospace, monospace',
  'be-vietnam-pro': 'var(--font-be-vietnam-pro), sans-serif',
  'noto-sans': 'var(--font-noto-sans), sans-serif',
  'source-sans-3': 'var(--font-source-sans-3), sans-serif',
  'roboto-slab': 'var(--font-roboto-slab), serif',
  merriweather: 'var(--font-merriweather), serif',
};

/** Numeric CSS `font-weight` for each named weight — shared by
 *  `FlowNodeCard`'s render and `fit-to-content.ts`'s offscreen
 *  measurement, so the two never drift apart. */
export const NODE_FONT_WEIGHTS: Record<'normal' | 'medium' | 'semibold' | 'bold', number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};
