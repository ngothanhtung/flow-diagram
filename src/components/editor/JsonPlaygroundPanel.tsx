'use client';

import { FileJson, FlaskConical, Play } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '@/lib/editor-store';
import type { FlowDocumentJSON } from '@/lib/flowchart-types';

/**
 * Validates a pasted document with the same rules /guide documents:
 * unique non-empty node ids, required node fields, and edges that
 * reference nodes which actually exist. Returns an error message, or
 * null when the document is safe to render.
 */
function validateDocument(parsed: unknown): string | null {
  if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as { nodes?: unknown }).nodes) || !Array.isArray((parsed as { edges?: unknown }).edges)) {
    return 'Document must be an object with "nodes" and "edges" arrays.';
  }
  const document = parsed as FlowDocumentJSON;
  const nodeIds = new Set<string>();
  for (const node of document.nodes) {
    if (!node || typeof node.id !== 'string' || !node.id) return 'Every node needs a non-empty string "id".';
    if (nodeIds.has(node.id)) return `Duplicate node id "${node.id}".`;
    if (!node.type || !node.title || !node.position) return `Node "${node.id}" is missing "type", "title", or "position".`;
    nodeIds.add(node.id);
  }
  for (const edge of document.edges) {
    if (!edge || typeof edge.id !== 'string' || !edge.id) return 'Every edge needs a non-empty string "id".';
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      return `Edge "${edge.id}" references a node id that doesn't exist ("${edge.from}" → "${edge.to}").`;
    }
  }
  return null;
}

/**
 * Paste a FlowDocumentJSON and render it on the canvas. Loading goes
 * through the same path a template load uses, so Reset and dirty
 * tracking behave exactly as they do for a template.
 */
export function JsonPlaygroundPanel({ document }: { document: FlowDocumentJSON }) {
  const loadRemoteTemplate = useEditorStore((state) => state.loadRemoteTemplate);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleRender = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch (err) {
      setError(`Invalid JSON: ${(err as Error).message}`);
      return;
    }
    const message = validateDocument(parsed);
    if (message) {
      setError(message);
      return;
    }
    const next = parsed as FlowDocumentJSON;
    setError(null);
    loadRemoteTemplate({ name: 'Pasted JSON', category: 'Playground', description: 'Rendered from the JSON playground panel.', document: next });
    toast.success('Rendered pasted JSON', { description: `${next.nodes.length} nodes, ${next.edges.length} edges` });
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
          }}
          title='Fill with the current canvas document'
        >
          <FileJson size={13} />
        </Button>
      </div>
    </div>
  );
}
