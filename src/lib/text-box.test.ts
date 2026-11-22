import { describe, expect, it } from 'vitest';
import type { FlowNode } from './flowchart-types';
import { TEXT_PADDING, textBoxStyle } from './node-style';

const text = (extra: Partial<FlowNode> = {}): FlowNode => ({ id: 't', type: 'text', title: 'x', position: { x: 0, y: 0 }, width: 200, height: 80, ...extra });

describe('textBoxStyle', () => {
  it('paints no box by default: a text object is just words, as before', () => {
    expect(textBoxStyle(text())).toEqual({ fill: null, stroke: null, strokeWidth: 0, borderStyle: 'solid', radius: 0, padding: TEXT_PADDING });
  });

  it('paints the fill, border, corner radius and padding the object sets', () => {
    expect(textBoxStyle(text({ backgroundColor: '#111827', borderColor: '#64748b', borderWidth: 2, borderStyle: 'dashed', cornerRadius: 8, padding: 16 }))).toEqual({
      fill: '#111827',
      stroke: '#64748b',
      strokeWidth: 2,
      borderStyle: 'dashed',
      radius: 8,
      padding: 16,
    });
  });

  it('draws a border only with both a colour and a width', () => {
    expect(textBoxStyle(text({ borderColor: '#64748b' })).stroke).toBeNull();
    expect(textBoxStyle(text({ borderWidth: 2 })).stroke).toBeNull();
  });

  it('clamps numbers and ignores values outside the vocabulary', () => {
    const style = textBoxStyle(text({ borderWidth: 99, cornerRadius: -3, padding: 500, borderStyle: 'wavy' as never, backgroundColor: 'red' as never, borderColor: 'blue' }));
    expect(style).toEqual({ fill: null, stroke: null, strokeWidth: 8, borderStyle: 'solid', radius: 0, padding: 64 });
  });

  it('never paints a box for another kind of node', () => {
    expect(textBoxStyle({ ...text({ backgroundColor: '#111827' }), type: 'process' }).fill).toBeNull();
  });
});
