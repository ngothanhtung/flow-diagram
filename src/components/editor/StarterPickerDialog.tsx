'use client';

import { GitBranch, MessagesSquare, Table2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEditorStore } from '@/lib/editor-store';
import { buildStarterDocument, STARTER_DIAGRAMS } from '@/lib/starter-diagrams';

const STARTER_ICON: Record<string, LucideIcon> = {
  flowchart: GitBranch,
  sequence: MessagesSquare,
  er: Table2,
};

/**
 * The three built-in starting points, offered so a new diagram doesn't
 * begin on a blank canvas.
 *
 * Deliberately separate from "New from template": templates are the
 * curated Firestore library an administrator maintains, and an empty
 * collection still yields an empty library. Starters ship with the app
 * and are always there.
 */
export function StarterPickerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const loadRemoteTemplate = useEditorStore((state) => state.loadRemoteTemplate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[92vw] max-w-2xl sm:max-w-2xl gap-0 overflow-hidden border-cyan-400/25 bg-popover p-0 ring-1 ring-cyan-400/25'>
        <DialogHeader className='px-8 pt-6 pb-4'>
          <DialogTitle className='text-base font-semibold text-foreground'>Start from a diagram</DialogTitle>
          <p className='mt-1 text-[11px] leading-relaxed text-muted-foreground'>A small, complete example of each kind, ready to edit. This replaces what&apos;s on the canvas.</p>
        </DialogHeader>

        <div className='flex flex-col gap-2 px-8 pb-6'>
          {STARTER_DIAGRAMS.map((starter) => {
            const Icon = STARTER_ICON[starter.id] ?? GitBranch;
            return (
              <button
                key={starter.id}
                type='button'
                onClick={() => {
                  loadRemoteTemplate({
                    name: starter.name,
                    category: 'Starter',
                    description: starter.description,
                    document: buildStarterDocument(starter),
                  });
                  onOpenChange(false);
                }}
                className='flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition hover:border-ring/40 hover:bg-muted/50'
              >
                <span className='mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-cyan-500/10 text-cyan-700 dark:text-cyan-200'>
                  <Icon size={15} />
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block text-[12px] font-semibold text-foreground'>{starter.name}</span>
                  <span className='mt-0.5 block text-[10px] leading-relaxed text-muted-foreground'>{starter.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className='flex justify-end border-t border-border px-8 py-4'>
          <Button type='button' variant='ghost' size='xs' onClick={() => onOpenChange(false)} className='text-muted-foreground hover:bg-accent hover:text-foreground'>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
