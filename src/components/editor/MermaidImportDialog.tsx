'use client';

import { AlertTriangle, FileCode2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useEditorStore } from '@/lib/editor-store';
import { importMermaid, MermaidImportError, type MermaidImportResult } from '@/lib/mermaid-import';
import { STARTER_DIAGRAMS } from '@/lib/starter-diagrams';

const KIND_LABEL: Record<MermaidImportResult['kind'], string> = {
  flowchart: 'Flowchart',
  sequence: 'Sequence diagram',
  er: 'ER diagram',
};

/**
 * Paste mermaid, get a diagram.
 *
 * Loading goes through `loadRemoteTemplate`, the same path a template
 * load takes, so Reset and dirty tracking behave exactly as they already
 * do — an import is "the canvas now holds this document", which is what
 * that action already means.
 *
 * The preview step is not ceremony: the importer is lenient by design
 * and reports what it dropped, and those warnings are only useful if the
 * user sees them *before* the paste replaces their canvas.
 */
export function MermaidImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const loadRemoteTemplate = useEditorStore((state) => state.loadRemoteTemplate);
  const [source, setSource] = useState('');
  const [preview, setPreview] = useState<MermaidImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setSource('');
    setPreview(null);
    setError(null);
  };

  const parse = (text: string) => {
    setSource(text);
    setError(null);
    if (!text.trim()) {
      setPreview(null);
      return;
    }
    try {
      setPreview(importMermaid(text));
    } catch (thrown) {
      setPreview(null);
      setError(thrown instanceof MermaidImportError ? thrown.message : `Could not read that diagram: ${(thrown as Error).message}`);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className='flex h-[88vh] max-h-210 w-[92vw] max-w-5xl sm:max-w-5xl flex-col gap-0 overflow-hidden border-cyan-400/25 bg-popover p-0 ring-1 ring-cyan-400/25'>
        <DialogHeader className='shrink-0 px-8 pt-6 pb-4'>
          <DialogTitle className='text-base font-semibold text-foreground'>Import from mermaid</DialogTitle>
          <p className='mt-1 text-[11px] leading-relaxed text-muted-foreground'>
            Paste a <code className='rounded bg-muted px-1 py-0.5 font-mono text-[10px]'>flowchart</code>, <code className='rounded bg-muted px-1 py-0.5 font-mono text-[10px]'>sequenceDiagram</code>{' '}
            or <code className='rounded bg-muted px-1 py-0.5 font-mono text-[10px]'>erDiagram</code>. Blocks are laid out automatically; everything is editable afterwards.
          </p>
        </DialogHeader>

        <div className='grid min-h-0 flex-1 grid-cols-5 gap-0 overflow-hidden'>
          <div className='col-span-3 flex min-h-0 flex-col px-8 pb-6'>
            <Textarea
              value={source}
              onChange={(event) => parse(event.target.value)}
              spellCheck={false}
              placeholder={'flowchart TD\n    A[Start] --> B{Valid?}\n    B -->|yes| C[(Save)]\n    B -->|no| D[/Error/]'}
              className='min-h-0 flex-1 resize-none border-border bg-muted/30 font-mono text-[11px] leading-relaxed focus-visible:border-cyan-400/50 focus-visible:ring-cyan-400/15'
            />
          </div>

          <div className='col-span-2 min-h-0 overflow-y-auto pr-8 pb-6 pl-2'>
            {error ? (
              <div className='rounded-lg bg-rose-500/10 px-3 py-2.5 ring-1 ring-rose-400/30'>
                <p className='text-[11px] leading-relaxed text-rose-700 dark:text-rose-200'>{error}</p>
              </div>
            ) : preview ? (
              <>
                <div className='rounded-lg bg-cyan-500/10 px-3 py-2.5 ring-1 ring-cyan-400/25'>
                  <p className='text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200'>{KIND_LABEL[preview.kind]}</p>
                  <p className='mt-1 text-[11px] text-foreground'>
                    {preview.document.nodes.length} {preview.document.nodes.length === 1 ? 'block' : 'blocks'} · {preview.document.edges.length} {preview.document.edges.length === 1 ? 'line' : 'lines'}
                  </p>
                </div>
                {preview.warnings.length > 0 && (
                  <div className='mt-3'>
                    <p className='flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300'>
                      <AlertTriangle size={11} /> {preview.warnings.length} {preview.warnings.length === 1 ? 'note' : 'notes'}
                    </p>
                    <ul className='mt-1.5 flex flex-col gap-1.5'>
                      {preview.warnings.map((warning, index) => (
                        <li key={index} className='rounded bg-amber-400/10 px-2 py-1.5 text-[10px] leading-relaxed text-amber-900 ring-1 ring-amber-400/20 dark:text-amber-100'>
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className='text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground'>Start from an example</p>
                <div className='mt-2 flex flex-col gap-2'>
                  {STARTER_DIAGRAMS.map((starter) => (
                    <button
                      key={starter.id}
                      type='button'
                      onClick={() => parse(starter.source)}
                      className='rounded-lg border border-border bg-card px-3 py-2.5 text-left transition hover:border-ring/40 hover:bg-muted/50'
                    >
                      <span className='flex items-center gap-2 text-[11px] font-semibold text-foreground'>
                        <FileCode2 size={12} className='shrink-0 text-cyan-700 dark:text-cyan-200' />
                        {starter.name}
                      </span>
                      <span className='mt-1 block text-[10px] leading-relaxed text-muted-foreground'>{starter.description}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className='flex shrink-0 items-center justify-between gap-2 border-t border-border px-8 py-4'>
          <p className='text-[10px] text-muted-foreground'>Importing replaces what&apos;s on the canvas.</p>
          <div className='flex gap-2'>
            <Button
              type='button'
              variant='ghost'
              size='xs'
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              className='text-muted-foreground hover:bg-accent hover:text-foreground'
            >
              Cancel
            </Button>
            <Button
              type='button'
              variant='accent'
              size='xs'
              disabled={!preview}
              onClick={() => {
                if (!preview) return;
                loadRemoteTemplate({
                  name: `Imported ${KIND_LABEL[preview.kind].toLowerCase()}`,
                  category: 'Mermaid import',
                  description: `${preview.document.nodes.length} blocks and ${preview.document.edges.length} lines imported from mermaid.`,
                  document: preview.document,
                });
                reset();
                onOpenChange(false);
              }}
            >
              <Sparkles size={13} /> Import
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
