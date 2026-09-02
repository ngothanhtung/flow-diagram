'use client';

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  Network,
  Scaling,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useEditorStore, type AlignEdge } from '@/lib/editor-store';

const ALIGN_TOOLS: ReadonlyArray<{ edge: AlignEdge; label: string; Icon: LucideIcon }> = [
  { edge: 'left', label: 'Align left', Icon: AlignStartVertical },
  { edge: 'center-x', label: 'Align centre (horizontal)', Icon: AlignCenterVertical },
  { edge: 'right', label: 'Align right', Icon: AlignEndVertical },
  { edge: 'top', label: 'Align top', Icon: AlignStartHorizontal },
  { edge: 'center-y', label: 'Align middle (vertical)', Icon: AlignCenterHorizontal },
  { edge: 'bottom', label: 'Align bottom', Icon: AlignEndHorizontal },
];

/**
 * Layout actions over the current multi-selection, mounted over the
 * canvas at the top edge — the opposite end from the shape dock, so the
 * two never fight for the same corner.
 *
 * It renders only from two nodes up: every action here needs something
 * to align *against*, and a bar that appears for a single node would
 * just be a row of disabled buttons.
 */
export function SelectionToolbar() {
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const alignSelectedNodes = useEditorStore((state) => state.alignSelectedNodes);
  const distributeSelectedNodes = useEditorStore((state) => state.distributeSelectedNodes);
  const matchSelectedNodeSize = useEditorStore((state) => state.matchSelectedNodeSize);
  const autoLayout = useEditorStore((state) => state.autoLayout);

  const count = selectedNodeIds.length;
  if (count < 2) return null;

  // Evening out gaps needs a middle node to move; with two there is
  // nothing between them to reposition.
  const canDistribute = count >= 3;

  return (
    <div
      className='pointer-events-auto absolute left-1/2 top-4 z-20 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-lg bg-popover/92 p-0.5 text-muted-foreground ring-1 ring-border shadow-[0_14px_40px_rgba(0,0,0,.28)] backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      role='toolbar'
      aria-label='Selection layout tools'
    >
      <span className='shrink-0 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-700 tabular-nums dark:text-cyan-200'>{count} selected</span>

      <Separator orientation='vertical' className='self-stretch bg-border' />

      {ALIGN_TOOLS.map(({ edge, label, Icon }) => (
        <Button key={edge} variant='ghost' size='icon-sm' onClick={() => alignSelectedNodes(edge)} title={label} aria-label={label} className='text-muted-foreground'>
          <Icon size={16} />
        </Button>
      ))}

      <Separator orientation='vertical' className='self-stretch bg-border' />

      <Button
        variant='ghost'
        size='icon-sm'
        disabled={!canDistribute}
        onClick={() => distributeSelectedNodes('x')}
        title={canDistribute ? 'Even out horizontal gaps' : 'Select 3 or more to even out gaps'}
        aria-label='Even out horizontal gaps'
        className='text-muted-foreground'
      >
        <AlignHorizontalDistributeCenter size={16} />
      </Button>
      <Button
        variant='ghost'
        size='icon-sm'
        disabled={!canDistribute}
        onClick={() => distributeSelectedNodes('y')}
        title={canDistribute ? 'Even out vertical gaps' : 'Select 3 or more to even out gaps'}
        aria-label='Even out vertical gaps'
        className='text-muted-foreground'
      >
        <AlignVerticalDistributeCenter size={16} />
      </Button>

      <Separator orientation='vertical' className='self-stretch bg-border' />

      <Button
        variant='ghost'
        size='icon-sm'
        onClick={() => matchSelectedNodeSize('both')}
        title='Match size to the last selected node'
        aria-label='Match size to the last selected node'
        className='text-muted-foreground'
      >
        <Scaling size={16} />
      </Button>

      <Separator orientation='vertical' className='self-stretch bg-border' />

      {/* Tidies just the selection — the lines between the selected
          blocks decide the ranks, and the result is shifted back so the
          block stays where the user left it on the canvas. */}
      <Button variant='ghost' size='icon-sm' onClick={() => autoLayout('TB')} title='Tidy the selection into ranks, top to bottom' aria-label='Tidy the selection top to bottom' className='text-muted-foreground'>
        <Network size={16} />
      </Button>
      <Button
        variant='ghost'
        size='icon-sm'
        onClick={() => autoLayout('LR')}
        title='Tidy the selection into ranks, left to right'
        aria-label='Tidy the selection left to right'
        className='text-muted-foreground'
      >
        <Network size={16} className='-rotate-90' />
      </Button>
    </div>
  );
}
