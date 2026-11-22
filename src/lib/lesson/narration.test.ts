import { describe, expect, it } from 'vitest';
import { NARRATION_COLORS, parseChangeLine, parseNarration, parseNarrationBlocks } from './narration';

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

  it('parses {colour|text}: a palette name or a hex colour, resolved to a hex value', () => {
    const [p] = parseNarration('a {red|hot} b {#52c41a|ok} c {#fff|w}');
    expect(p.filter((i) => i.kind === 'color')).toEqual([
      { kind: 'color', text: 'hot', color: NARRATION_COLORS.red },
      { kind: 'color', text: 'ok', color: '#52c41a' },
      { kind: 'color', text: 'w', color: '#fff' },
    ]);
  });

  it('leaves an unknown colour, a bad hex, an empty body or an unclosed brace as text', () => {
    for (const source of ['{nope|x}', '{#12|x}', '{red|}', '{red|x', 'json {"a": 1}', '{red;x:y|z}']) {
      expect(parseNarration(source), source).toEqual([[{ kind: 'text', text: source }]]);
    }
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

describe('parseNarrationBlocks', () => {
  const text = (t: string) => [{ kind: 'text', text: t }];

  it('keeps old Narration as paragraphs, single newlines included', () => {
    expect(parseNarrationBlocks('first line\nsame paragraph\n\nsecond **b**')).toEqual([
      { kind: 'paragraph', content: text('first line\nsame paragraph') },
      { kind: 'paragraph', content: [{ kind: 'text', text: 'second ' }, { kind: 'bold', text: 'b' }] },
    ]);
  });

  it('groups bullet and numbered items into lists', () => {
    expect(parseNarrationBlocks('Steps:\n- one\n* two **b**\n\n1. first\n2) second')).toEqual([
      { kind: 'paragraph', content: text('Steps:') },
      { kind: 'list', ordered: false, items: [text('one'), [{ kind: 'text', text: 'two ' }, { kind: 'bold', text: 'b' }]] },
      { kind: 'list', ordered: true, items: [text('first'), text('second')] },
    ]);
  });

  it('reads # to ### as a small heading', () => {
    expect(parseNarrationBlocks('### Why\nBecause.')).toEqual([
      { kind: 'heading', content: text('Why') },
      { kind: 'paragraph', content: text('Because.') },
    ]);
    expect(parseNarrationBlocks('#### four')).toEqual([{ kind: 'paragraph', content: text('#### four') }]);
  });

  it('keeps a code block raw, markers included, and runs an unclosed one to the end', () => {
    expect(parseNarrationBlocks('```sql\nSELECT **x** [[y]]\n\n  indented\n```\nafter')).toEqual([
      { kind: 'code', text: 'SELECT **x** [[y]]\n\n  indented' },
      { kind: 'paragraph', content: text('after') },
    ]);
    expect(parseNarrationBlocks('```\nopen')).toEqual([{ kind: 'code', text: 'open' }]);
  });

  it('does not read *italic* at the start of a line as a list', () => {
    expect(parseNarrationBlocks('*only* this')).toEqual([{ kind: 'paragraph', content: [{ kind: 'italic', text: 'only' }, { kind: 'text', text: ' this' }] }]);
  });

  it('keeps HTML as text in every block', () => {
    const blocks = parseNarrationBlocks('- <b>x</b>\n### <i>y</i>');
    expect(JSON.stringify(blocks)).toContain('<b>x</b>');
    expect(blocks.flatMap((b) => (b.kind === 'list' ? b.items.flat() : b.kind === 'code' ? [] : b.content)).every((i) => i.kind === 'text')).toBe(true);
  });
});

describe('parseChangeLine', () => {
  it.each([
    ['+ a', { sign: '+', text: 'a' }],
    ['  ~b', { sign: '~', text: 'b' }],
    ['- x y', { sign: '-', text: 'x y' }],
    ['plain', { sign: null, text: 'plain' }],
    ['', { sign: null, text: '' }],
  ])('%j', (line, expected) => {
    expect(parseChangeLine(line)).toEqual(expected);
  });
});
