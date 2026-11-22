// Narration markup: a tiny, safe subset of Markdown. Output is data, never
// HTML — the renderer maps it to React nodes, so markup characters in a
// source can't become elements. Inline: **bold**, *italic*, `code`,
// [[term]], {colour|text} (a palette name or a hex colour; no nesting; an
// unclosed marker, an unknown colour stays literal text). Blocks
// (parseNarrationBlocks): paragraphs split on blank lines, `- `/`* ` and
// `1. ` lists, `#`–`###` small headings, ``` code blocks. No links, no HTML.
export type NarrationInline = { kind: 'text' | 'bold' | 'italic' | 'code' | 'term'; text: string } | { kind: 'color'; text: string; color: string };

/** The names `{name|text}` accepts: mid-tone hues that read on a light and a dark canvas alike. */
export const NARRATION_COLORS: Readonly<Record<string, string>> = {
  red: '#ff4d4f',
  orange: '#fa8c16',
  gold: '#faad14',
  lime: '#a0d911',
  green: '#52c41a',
  cyan: '#13c2c2',
  blue: '#1890ff',
  purple: '#9254de',
  magenta: '#eb2f96',
};
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** `{colour|text}` at `i`: a palette name or a hex colour, and a non-empty text; null when it isn't one. */
function colorSpan(line: string, i: number): { text: string; color: string; end: number } | null {
  if (line[i] !== '{') return null;
  const bar = line.indexOf('|', i + 1);
  const close = line.indexOf('}', i + 1);
  if (bar < 0 || close < 0 || bar > close || close === bar + 1) return null;
  const name = line.slice(i + 1, bar);
  const color = Object.hasOwn(NARRATION_COLORS, name) ? NARRATION_COLORS[name] : HEX_COLOR.test(name) ? name : null;
  return color ? { text: line.slice(bar + 1, close), color, end: close + 1 } : null;
}
export type NarrationParagraph = NarrationInline[];

const MARKERS: { open: string; close: string; kind: 'bold' | 'italic' | 'code' | 'term' }[] = [
  { open: '[[', close: ']]', kind: 'term' },
  { open: '**', close: '**', kind: 'bold' },
  { open: '`', close: '`', kind: 'code' },
  { open: '*', close: '*', kind: 'italic' },
];

function parseInline(line: string): NarrationParagraph {
  const out: NarrationParagraph = [];
  let plain = '';
  const flush = () => {
    if (plain) out.push({ kind: 'text', text: plain });
    plain = '';
  };
  let i = 0;
  while (i < line.length) {
    let matched = false;
    const span = colorSpan(line, i);
    if (span) {
      flush();
      out.push({ kind: 'color', text: span.text, color: span.color });
      i = span.end;
      continue;
    }
    for (const m of MARKERS) {
      if (!line.startsWith(m.open, i)) continue;
      const end = line.indexOf(m.close, i + m.open.length);
      if (end <= i + m.open.length) continue; // unclosed or empty
      flush();
      out.push({ kind: m.kind, text: line.slice(i + m.open.length, end) });
      i = end + m.close.length;
      matched = true;
      break;
    }
    if (!matched) plain += line[i++];
  }
  flush();
  return out;
}

export function parseNarration(source: string): NarrationParagraph[] {
  return source
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n(?:[ \t]*\n)*/)
    .filter((p) => p.trim() !== '')
    .map((p) => parseInline(p.trim()));
}

export type NarrationBlock =
  | { kind: 'paragraph' | 'heading'; content: NarrationParagraph }
  | { kind: 'list'; ordered: boolean; items: NarrationParagraph[] }
  | { kind: 'code'; text: string };

const FENCE = /^\s*```/;
const HEADING = /^\s*#{1,3}\s+(.*)$/;
const BULLET = /^\s*[-*]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;

/**
 * Narration as blocks. A source without block syntax gives exactly the
 * paragraphs `parseNarration` gives (single newlines kept inside them), so
 * Narration written before blocks existed renders unchanged. A code block
 * is kept raw — no inline markup inside — and an unclosed one runs to the end.
 */
export function parseNarrationBlocks(source: string): NarrationBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: NarrationBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    const text = paragraph.join('\n').trim();
    if (text) blocks.push({ kind: 'paragraph', content: parseInline(text) });
    paragraph = [];
    if (list) blocks.push({ kind: 'list', ordered: list.ordered, items: list.items.map((item) => parseInline(item.trim())) });
    list = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (FENCE.test(line)) {
      flush();
      const code: string[] = [];
      for (i += 1; i < lines.length && !FENCE.test(lines[i]); i += 1) code.push(lines[i]);
      blocks.push({ kind: 'code', text: code.join('\n') });
      continue;
    }
    if (line.trim() === '') {
      flush();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: 'heading', content: parseInline(heading[1].trim()) });
      continue;
    }
    const bullet = BULLET.exec(line);
    const ordered = bullet ? null : ORDERED.exec(line);
    const item = bullet ?? ordered;
    if (item) {
      const isOrdered = ordered !== null;
      if (paragraph.length > 0 || (list && list.ordered !== isOrdered)) flush();
      list ??= { ordered: isOrdered, items: [] };
      list.items.push(item[1]);
      continue;
    }
    // A plain line right after a list item continues that item.
    if (list) list.items[list.items.length - 1] += ` ${line.trim()}`;
    else paragraph.push(line);
  }
  flush();
  return blocks;
}

/** One "what changed" line: its leading `+` / `~` / `-` sign (if any) and the rest. */
export function parseChangeLine(line: string): { sign: '+' | '~' | '-' | null; text: string } {
  const trimmed = line.trimStart();
  const first = trimmed[0];
  if (first === '+' || first === '~' || first === '-') return { sign: first, text: trimmed.slice(1).trimStart() };
  return { sign: null, text: line };
}
