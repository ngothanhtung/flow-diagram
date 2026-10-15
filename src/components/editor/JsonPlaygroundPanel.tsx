'use client';

import { FileJson, FlaskConical, Play } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { checkDocument } from '@/lib/document-validation';
import { useEditorStore } from '@/lib/editor-store';
import type { FlowDocumentJSON } from '@/lib/flowchart-types';

/**
 * Paste a FlowDocumentJSON and render it on the canvas. Loading goes
 * through the same path a template load uses, so Reset and dirty
 * tracking behave exactly as they do for a template.
 */
export function JsonPlaygroundPanel({ document }: { document: FlowDocumentJSON }) {
  const loadRemoteTemplate = useEditorStore((state) => state.loadRemoteTemplate);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  // What `normalizeDocument` repaired on the last render — shown in full
  // under the editor so the author can fix the JSON at its source.
  const [fixes, setFixes] = useState<string[]>([]);

  const handleRender = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch (err) {
      setError(`Invalid JSON: ${(err as Error).message}`);
      setFixes([]);
      return;
    }
    const checked = checkDocument(parsed);
    if (!checked.ok) {
      setError(checked.error);
      setFixes([]);
      return;
    }
    const next = checked.document;
    setError(null);
    setFixes(checked.fixes);
    loadRemoteTemplate({ name: 'Pasted JSON', category: 'Playground', description: 'Rendered from the JSON playground panel.', document: next });
    const summary = `${next.nodes.length} nodes, ${next.edges.length} edges`;
    if (checked.fixes.length > 0) toast.warning('Rendered pasted JSON with repairs', { description: `${summary}. Repaired ${checked.fixes.length} invalid ${checked.fixes.length === 1 ? 'value' : 'values'} — see the list under the editor.` });
    else toast.success('Rendered pasted JSON', { description: summary });
  };

  return (
    <div className='rounded-xl bg-card p-3'>
      <span className='flex items-center gap-1.5 text-xs font-semibold text-foreground'>
        <FlaskConical size={13} className='text-cyan-600 dark:text-cyan-300' />
        JSON Playground
      </span>
      <p className='mt-2 text-[11px] leading-relaxed text-muted-foreground'>
        Paste a FlowDocumentJSON below and render it on the canvas — see the{' '}
        <Link href='/guide' target='_blank' className='text-cyan-600 underline underline-offset-2 hover:text-cyan-500 dark:text-cyan-300 dark:hover:text-cyan-200'>
          authoring guide
        </Link>{' '}
        for the schema. Rendering replaces the current canvas — Save to keep it, or Reset to revert.
      </p>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder='{ "nodes": [...], "edges": [...] }'
        spellCheck={false}
        className='mt-3 h-56 w-full resize-y rounded-lg border border-border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30'
      />
      {error && <p className='mt-2 rounded-md bg-rose-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-rose-600 dark:text-rose-300 ring-1 ring-rose-400/30'>{error}</p>}
      {fixes.length > 0 && (
        <div className='mt-2 rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-amber-700 ring-1 ring-amber-400/30 dark:text-amber-200'>
          <p className='font-semibold'>
            Rendered with {fixes.length} {fixes.length === 1 ? 'repair' : 'repairs'} — these values were outside the Diagram JSON vocabulary:
          </p>
          <ul className='mt-1 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-4'>
            {fixes.map((fix, index) => (
              <li key={index}>{fix}</li>
            ))}
          </ul>
        </div>
      )}
      <div className='mt-3 flex items-center gap-2'>
        <Button variant='accent' onClick={handleRender} disabled={!draft.trim()} className='flex-1 text-xs font-semibold'>
          <Play size={13} />
          Render
        </Button>
        <Button
          variant='toolbar'
          onClick={() => {
            setDraft(JSON.stringify(document, null, 2));
            setError(null);
            setFixes([]);
          }}
          title='Fill with the current canvas document'
        >
          <FileJson size={13} />
        </Button>
      </div>
    </div>
  );
}
