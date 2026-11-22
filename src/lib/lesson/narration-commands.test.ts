import { describe, expect, it } from 'vitest';
import { applyEdit, fenceBlock, prefixLines, toggleWrap, type TextEdit } from './narration-commands';

/** The document and selection after an edit, with the selection marked as [ ]. */
function run(doc: string, from: number, to: number, edit: (doc: string, from: number, to: number) => TextEdit): string {
  const result = edit(doc, from, to);
  const next = applyEdit(doc, result);
  return `${next.slice(0, result.selectFrom)}[${next.slice(result.selectFrom, result.selectTo)}]${next.slice(result.selectTo)}`;
}

describe('toggleWrap', () => {
  const bold = (d: string, f: number, t: number) => toggleWrap(d, f, t, '**');
  const italic = (d: string, f: number, t: number) => toggleWrap(d, f, t, '*');
  const term = (d: string, f: number, t: number) => toggleWrap(d, f, t, '[[', ']]');

  it('wraps the selection and keeps the words selected', () => {
    expect(run('a word b', 2, 6, bold)).toBe('a **[word]** b');
    expect(run('a word b', 2, 6, term)).toBe('a [[[word]]] b');
  });

  it('puts the cursor between the markers when nothing is selected', () => {
    expect(run('ab', 1, 1, bold)).toBe('a**[]**b');
  });

  it('unwraps when the selection is already wrapped, inside or outside the markers', () => {
    expect(run('a **word** b', 4, 8, bold)).toBe('a [word] b');
    expect(run('a **word** b', 2, 10, bold)).toBe('a [word] b');
  });

  it('does not take the stars of bold for italic', () => {
    expect(run('**word**', 2, 6, italic)).toBe('***[word]***');
  });
});

describe('prefixLines', () => {
  const bullet = (d: string, f: number, t: number) => prefixLines(d, f, t, 'bullet');
  const ordered = (d: string, f: number, t: number) => prefixLines(d, f, t, 'ordered');
  const heading = (d: string, f: number, t: number) => prefixLines(d, f, t, 'heading');

  it('prefixes every selected line', () => {
    expect(run('intro\none\ntwo', 7, 12, bullet)).toBe('intro\n[- one\n- two]');
    expect(run('one\ntwo', 0, 7, ordered)).toBe('[1. one\n2. two]');
    expect(run('Why', 1, 1, heading)).toBe('[### Why]');
  });

  it('removes the prefix when every line has it', () => {
    expect(run('- one\n- two', 0, 11, bullet)).toBe('[one\ntwo]');
    expect(run('### Why', 0, 0, heading)).toBe('[Why]');
  });

  it('swaps one list kind for the other', () => {
    expect(run('- one\n- two', 0, 11, ordered)).toBe('[1. one\n2. two]');
  });
});

describe('fenceBlock', () => {
  it('fences the selected lines', () => {
    expect(run('SELECT 1', 0, 8, fenceBlock)).toBe('```\n[SELECT 1]\n```');
  });

  it('puts an empty block on its own lines and the cursor inside', () => {
    expect(run('text', 4, 4, fenceBlock)).toBe('text\n```\n[]\n```');
  });
});
