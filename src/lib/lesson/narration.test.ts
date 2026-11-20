import { describe, expect, it } from 'vitest';
import { parseNarration } from './narration';

describe('parseNarration', () => {
  it('splits paragraphs on blank lines', () => {
    expect(parseNarration('a\n\nb\n\n\nc')).toHaveLength(3);
  });

  it('parses bold, italic, code and term', () => {
    const [p] = parseNarration('x **b** *i* `c` [[t]]');
    expect(p.filter((i) => i.kind !== 'text')).toEqual([
      { kind: 'bold', text: 'b' },
      { kind: 'italic', text: 'i' },
      { kind: 'code', text: 'c' },
      { kind: 'term', text: 't' },
    ]);
  });

  it('leaves unclosed markers as text', () => {
    expect(parseNarration('a **b')).toEqual([[{ kind: 'text', text: 'a **b' }]]);
  });

  it('does not parse inside code', () => {
    expect(parseNarration('`**x**`')).toEqual([[{ kind: 'code', text: '**x**' }]]);
  });

  it('keeps HTML as plain text', () => {
    const src = '<script>alert(1)</script> <img src=x onerror=y>';
    const [p] = parseNarration(src);
    expect(p.every((i) => i.kind === 'text')).toBe(true);
    expect(p.map((i) => i.text).join('')).toBe(src);
  });
});
