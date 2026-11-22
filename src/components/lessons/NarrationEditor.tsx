'use client';

// The Markdown editor for a Lesson step's Narration (Body, Callout), after
// DocsHub's Studio editor: CodeMirror 6 with Markdown highlighting, a small
// toolbar, ⌘B / ⌘I / ⌘E and a Write | Preview switch — Preview is the very
// component the lesson viewer renders, so what you see is what learners get.
// Only the Narration subset exists (lib/lesson/narration.ts): no links, no
// HTML, no images.

import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorSelection, Prec } from '@codemirror/state';
import { EditorView, keymap, placeholder as placeholderText } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import CodeMirror from '@uiw/react-codemirror';
import { Bold, Code, Heading3, Italic, List, ListOrdered, SquareCode } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { FieldLabel } from '@/components/lessons/lesson-fields';
import { NarrationText } from '@/components/lessons/NarrationText';
import { useEditorStore } from '@/lib/editor-store';
import { fenceBlock, prefixLines, toggleWrap, type TextEdit } from '@/lib/lesson/narration-commands';

type Command = (doc: string, from: number, to: number) => TextEdit;

const COMMANDS: { id: string; label: string; keys?: string; icon: ReactNode; run: Command }[] = [
  { id: 'bold', label: 'Bold', keys: '⌘B', icon: <Bold size={13} />, run: (d, f, t) => toggleWrap(d, f, t, '**') },
  { id: 'italic', label: 'Italic', keys: '⌘I', icon: <Italic size={13} />, run: (d, f, t) => toggleWrap(d, f, t, '*') },
  { id: 'code', label: 'Inline code', keys: '⌘E', icon: <Code size={13} />, run: (d, f, t) => toggleWrap(d, f, t, '`') },
  { id: 'term', label: 'Term', icon: <span className='whitespace-nowrap font-mono text-[10px] font-bold leading-none'>[[ ]]</span>, run: (d, f, t) => toggleWrap(d, f, t, '[[', ']]') },
  { id: 'bullet', label: 'Bulleted list', icon: <List size={13} />, run: (d, f, t) => prefixLines(d, f, t, 'bullet') },
  { id: 'ordered', label: 'Numbered list', icon: <ListOrdered size={13} />, run: (d, f, t) => prefixLines(d, f, t, 'ordered') },
  { id: 'heading', label: 'Small heading', icon: <Heading3 size={13} />, run: (d, f, t) => prefixLines(d, f, t, 'heading') },
  { id: 'fence', label: 'Code block', icon: <SquareCode size={13} />, run: fenceBlock },
];

/** One command as one CodeMirror transaction (one native undo step). */
function runCommand(view: EditorView, command: Command): boolean {
  const { from, to } = view.state.selection.main;
  const edit = command(view.state.doc.toString(), from, to);
  view.dispatch({ changes: { from: edit.from, to: edit.to, insert: edit.insert }, selection: EditorSelection.single(edit.selectFrom, edit.selectTo), userEvent: 'input', scrollIntoView: true });
  return true;
}

// Colours come from the app's theme tokens, so one style serves light and dark.
const HIGHLIGHT = HighlightStyle.define([
  { tag: tags.heading, fontWeight: '700', color: 'var(--foreground)' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.monospace, color: 'oklch(0.6 0.12 230)' },
  { tag: [tags.processingInstruction, tags.list, tags.contentSeparator, tags.quote], color: 'var(--muted-foreground)' },
]);

const THEME = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: 'var(--foreground)', fontSize: '11px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
  '.cm-content': { padding: '6px 0', caretColor: 'var(--foreground)' },
  '.cm-line': { padding: '0 10px' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--foreground)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: 'color-mix(in oklab, var(--foreground) 18%, transparent)' },
  '.cm-placeholder': { color: 'var(--muted-foreground)' },
});

/**
 * One stretch of typing = one app undo step: the first change opens a
 * history gesture (unless one is open already — a toolbar press, this very
 * typing), leaving the editor closes the one it opened.
 */
function createTypingGesture() {
  let id: number | null = null;
  return {
    change() {
      const store = useEditorStore.getState();
      if (!store.history.gesture) id = store.beginHistoryGesture();
    },
    end() {
      if (id !== null) useEditorStore.getState().endHistoryGesture(id);
      id = null;
    },
  };
}

// Constant: @uiw/react-codemirror rebuilds every extension when basicSetup
// changes identity.
const BASIC_SETUP = { lineNumbers: false, foldGutter: false, highlightActiveLine: false, highlightActiveLineGutter: false, autocompletion: false, searchKeymap: false };

/**
 * `value` is read once (the parent keys this by history revision and Lesson
 * step, like the other fields); every edit is written through `onChange`.
 * A stretch of typing is one undo step of the app (`createTypingGesture`) —
 * what `useHistoryGestureScope` does for plain inputs, through an onChange
 * React never reports for CodeMirror's contenteditable.
 */
export function NarrationEditor({ label, value, onChange, placeholder, minLines = 4, hint }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; minLines?: number; hint?: string }) {
  const [draft, setDraft] = useState(value);
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const viewRef = useRef<EditorView | null>(null);
  const [typing] = useState(createTypingGesture);

  const extensions = useMemo(
    () => [
      markdown(),
      syntaxHighlighting(HIGHLIGHT),
      EditorView.lineWrapping,
      THEME,
      EditorView.contentAttributes.of({ 'aria-label': label || 'Narration' }),
      ...(placeholder ? [placeholderText(placeholder)] : []),
      EditorView.domEventHandlers({
        blur: () => {
          typing.end();
          return false;
        },
      }),
      Prec.highest(
        keymap.of([
          { key: 'Mod-b', preventDefault: true, run: (view) => runCommand(view, COMMANDS[0].run) },
          { key: 'Mod-i', preventDefault: true, run: (view) => runCommand(view, COMMANDS[1].run) },
          { key: 'Mod-e', preventDefault: true, run: (view) => runCommand(view, COMMANDS[2].run) },
        ]),
      ),
    ],
    [label, placeholder, typing],
  );

  const handleChange = (next: string) => {
    typing.change();
    setDraft(next);
    onChange(next);
  };

  const minHeight = `${minLines * 1.6 * 11 + 12}px`;
  const tab = (active: boolean) => `rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${active ? 'bg-background text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'}`;

  return (
    <div>
      <div className='mb-1 flex items-end justify-between gap-2'>
        {label ? <FieldLabel>{label}</FieldLabel> : <span />}
        <div className='flex gap-0.5 rounded-md bg-muted p-0.5' role='tablist' aria-label={`${label || 'Narration'} view`}>
          <button type='button' role='tab' aria-selected={mode === 'write'} className={tab(mode === 'write')} onClick={() => setMode('write')}>
            Write
          </button>
          <button type='button' role='tab' aria-selected={mode === 'preview'} className={tab(mode === 'preview')} onClick={() => setMode('preview')}>
            Preview
          </button>
        </div>
      </div>
      <div className='overflow-hidden rounded-md border border-border bg-muted/30 transition focus-within:border-sky-400/50 focus-within:ring-3 focus-within:ring-sky-400/15'>
        {mode === 'write' && (
          <div className='flex flex-wrap items-center gap-0.5 border-b border-border px-1 py-0.5'>
            {COMMANDS.map((command) => (
              <button
                key={command.id}
                type='button'
                title={command.keys ? `${command.label} (${command.keys})` : command.label}
                aria-label={command.label}
                // Keep the editor's focus and selection: the command acts on them.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (viewRef.current) runCommand(viewRef.current, command.run);
                  viewRef.current?.focus();
                }}
                className='grid h-6 min-w-6 place-items-center rounded px-1 text-muted-foreground transition hover:bg-accent hover:text-foreground'
              >
                {command.icon}
              </button>
            ))}
          </div>
        )}
        {mode === 'write' ? (
          <CodeMirror
            value={draft}
            onChange={handleChange}
            onCreateEditor={(view) => {
              viewRef.current = view;
            }}
            extensions={extensions}
            basicSetup={BASIC_SETUP}
            theme='none'
            minHeight={minHeight}
            maxHeight='420px'
          />
        ) : (
          <div className='overflow-auto px-2.5 py-1.5 text-[12px] leading-relaxed text-foreground/90' style={{ minHeight, maxHeight: 420 }}>
            {draft.trim() ? <NarrationText source={draft} /> : <p className='text-muted-foreground'>Nothing to preview yet.</p>}
          </div>
        )}
      </div>
      {hint && <p className='mt-1 text-[9px] leading-relaxed text-muted-foreground'>{hint}</p>}
    </div>
  );
}
