// The Narration editor's toolbar commands, as pure text edits: given the
// document and the selection, each returns one replacement plus the
// selection to show after it. The editor (components/lessons/NarrationEditor)
// turns that into one CodeMirror transaction — one undo step.

export interface TextEdit {
  /** Replace doc[from, to) with `insert`… */
  from: number;
  to: number;
  insert: string;
  /** …then select [selectFrom, selectTo) in the new document. */
  selectFrom: number;
  selectTo: number;
}

export function applyEdit(doc: string, edit: TextEdit): string {
  return doc.slice(0, edit.from) + edit.insert + doc.slice(edit.to);
}

/**
 * Wraps the selection in `open`…`close`, or unwraps it when it already is
 * (markers just outside the selection, or as its first and last characters).
 * `*` never counts the stars of a `**bold**` as its own.
 */
export function toggleWrap(doc: string, from: number, to: number, open: string, close = open): TextEdit {
  const selected = doc.slice(from, to);
  const star = open === '*';
  const outside =
    from >= open.length &&
    doc.slice(from - open.length, from) === open &&
    doc.slice(to, to + close.length) === close &&
    !(star && (doc[from - open.length - 1] === '*' || doc[to + close.length] === '*'));
  if (outside) {
    const start = from - open.length;
    return { from: start, to: to + close.length, insert: selected, selectFrom: start, selectTo: start + selected.length };
  }
  const inside =
    selected.length >= open.length + close.length &&
    selected.startsWith(open) &&
    selected.endsWith(close) &&
    !(star && (selected[1] === '*' || selected[selected.length - 2] === '*'));
  if (inside) {
    const inner = selected.slice(open.length, selected.length - close.length);
    return { from, to, insert: inner, selectFrom: from, selectTo: from + inner.length };
  }
  return { from, to, insert: open + selected + close, selectFrom: from + open.length, selectTo: from + open.length + selected.length };
}

export type LinePrefix = 'bullet' | 'ordered' | 'heading';

const PREFIX_TEST: Record<LinePrefix, RegExp> = {
  bullet: /^\s*[-*]\s+/,
  ordered: /^\s*\d+[.)]\s+/,
  heading: /^\s*#{1,3}\s+/,
};
const ANY_PREFIX = /^\s*(?:[-*]|\d+[.)]|#{1,3})\s+/;

/**
 * Turns the selected lines into a bulleted list, a numbered list or a
 * small heading — or back to plain lines when they all already are. Any
 * other list or heading prefix is replaced, so one list kind swaps for the
 * other. Blank lines are left alone.
 */
export function prefixLines(doc: string, from: number, to: number, kind: LinePrefix): TextEdit {
  const start = doc.lastIndexOf('\n', from - 1) + 1;
  const newline = doc.indexOf('\n', to);
  const end = newline < 0 ? doc.length : newline;
  const lines = doc.slice(start, end).split('\n');
  const filled = lines.filter((line) => line.trim() !== '');
  const remove = filled.length > 0 && filled.every((line) => PREFIX_TEST[kind].test(line));
  let number = 0;
  const next = lines.map((line) => {
    if (line.trim() === '') return line;
    const bare = line.replace(ANY_PREFIX, '');
    if (remove) return bare;
    number += 1;
    return `${kind === 'bullet' ? '- ' : kind === 'ordered' ? `${number}. ` : '### '}${bare}`;
  });
  const insert = next.join('\n');
  return { from: start, to: end, insert, selectFrom: start, selectTo: start + insert.length };
}

/** Puts the selection in a ``` code block on lines of its own; the cursor lands inside an empty one. */
export function fenceBlock(doc: string, from: number, to: number): TextEdit {
  const selected = doc.slice(from, to);
  const lead = from > 0 && doc[from - 1] !== '\n' ? '\n' : '';
  const trail = to < doc.length && doc[to] !== '\n' ? '\n' : '';
  const insert = `${lead}\`\`\`\n${selected}\n\`\`\`${trail}`;
  const selectFrom = from + lead.length + 4;
  return { from, to, insert, selectFrom, selectTo: selectFrom + selected.length };
}
