'use client';

import { useMemo } from 'react';
import { toast } from 'sonner';
import { autoLayoutScope, canAutoLayout, type LayoutDirection } from '@/lib/auto-layout';
import { useEditorStore } from '@/lib/editor-store';

export const AUTO_LAYOUT_DIRECTIONS: ReadonlyArray<{ direction: LayoutDirection; label: string }> = [
  { direction: 'TB', label: 'top to bottom' },
  { direction: 'LR', label: 'left to right' },
];

/**
 * The Auto-layout command, shared by the File menu (whole Diagram, or the
 * selection) and the selection toolbar, so both report the same way.
 *
 * It applies at once and says so in a toast whose Undo button undoes it —
 * but only while the layout is still the latest change: after a further
 * edit, "undo" from a stale toast would undo that edit instead, so the
 * button says to use the header's Undo rather than guess.
 */
export function useAutoLayoutCommand() {
  const doc = useEditorStore((state) => state.doc);
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const available = useMemo(() => canAutoLayout(doc, selectedNodeIds), [doc, selectedNodeIds]);
  /** Whether the command would arrange the selection rather than the whole Diagram. */
  const scoped = useMemo(() => autoLayoutScope(doc, selectedNodeIds).length > 0, [doc, selectedNodeIds]);
  const run = (direction: LayoutDirection) => {
    const result = useEditorStore.getState().autoLayout(direction);
    const label = AUTO_LAYOUT_DIRECTIONS.find((entry) => entry.direction === direction)!.label;
    if (!result.document) {
      toast('Already arranged', { description: `Auto-layout ${label} would not change anything.` });
      return;
    }
    const produced = result.document;
    toast.success(result.scoped ? 'Selection arranged' : 'Diagram arranged', {
      description: `Auto-layout, ${label}.`,
      action: {
        label: 'Undo',
        onClick: () => {
          const state = useEditorStore.getState();
          if (state.doc === produced && state.history.past.at(-1)?.after.doc === produced) state.undo();
          else toast('The Diagram has changed since', { description: 'Use Undo in the header to step back through those changes first.' });
        },
      },
    });
  };
  return { available, scoped, run };
}
