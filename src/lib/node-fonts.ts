import type { NodeFont } from './flowchart-types';

export const NODE_FONT_OPTIONS: ReadonlyArray<{
  value: NodeFont;
  label: string;
  character: string;
}> = [
  { value: 'geist-mono', label: 'Geist Mono', character: 'Kỹ thuật' },
  { value: 'be-vietnam-pro', label: 'Be Vietnam Pro', character: 'Hiện đại' },
  { value: 'noto-sans', label: 'Noto Sans', character: 'Dễ đọc' },
  { value: 'source-sans-3', label: 'Source Sans 3', character: 'Gọn gàng' },
  { value: 'roboto-slab', label: 'Roboto Slab', character: 'Kiến trúc' },
  { value: 'merriweather', label: 'Merriweather', character: 'Trang trọng' },
];

export const NODE_FONT_FAMILIES: Record<NodeFont, string> = {
  'geist-mono': 'var(--font-geist-mono), ui-monospace, monospace',
  'be-vietnam-pro': 'var(--font-be-vietnam-pro), sans-serif',
  'noto-sans': 'var(--font-noto-sans), sans-serif',
  'source-sans-3': 'var(--font-source-sans-3), sans-serif',
  'roboto-slab': 'var(--font-roboto-slab), serif',
  merriweather: 'var(--font-merriweather), serif',
};
