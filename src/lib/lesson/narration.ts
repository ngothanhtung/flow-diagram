// Narration markup: a tiny, safe subset. Output is data, never HTML — the
// renderer maps it to React nodes, so markup characters in a source can't
// become elements. No nesting; an unclosed marker stays literal text.
export type NarrationInline = { kind: 'text' | 'bold' | 'italic' | 'code' | 'term'; text: string };
export type NarrationParagraph = NarrationInline[];

const MARKERS: { open: string; close: string; kind: NarrationInline['kind'] }[] = [
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
