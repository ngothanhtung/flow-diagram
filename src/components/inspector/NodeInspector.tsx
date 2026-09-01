'use client';

import { Card } from '@/components/ui/card';
import type { FlowNode } from '@/lib/flowchart-types';
import { BlockInspector } from './BlockInspector';
import { GroupInspector } from './GroupInspector';
import { IconInspector } from './IconInspector';
import { TextInspector } from './TextInspector';

interface NodeInspectorProps {
  node: FlowNode | null;
  onUpdate: (id: string, patch: Partial<Omit<FlowNode, 'id'>>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  /** How many blocks this frame holds — only read for a `group` node. */
  memberCount?: number;
  /** Title of the frame this node sits in, when it sits in one. */
  parentTitle?: string | null;
  onUngroup?: (id: string) => void;
  onFitGroup?: (id: string) => void;
  onAddLane?: (id: string) => void;
}

/**
 * Picks the inspector panel for the selected node.
 *
 * The four kinds paint genuinely different things — a block has a body,
 * a text object has only words, a frame has a wash and a title bar, a
 * free icon/logo object has only a glyph — so each gets its own panel
 * rather than one panel full of guards. Anything two of them share lives
 * in `./fields`.
 */
export function NodeInspector({ node, onUpdate, onDuplicate, onDelete, memberCount = 0, parentTitle = null, onUngroup, onFitGroup, onAddLane }: NodeInspectorProps) {
  if (!node) {
    return (
      <Card size='sm' className='gap-0 bg-card py-3 pr-3 pl-1 ring-0'>
        <h2 className='text-sm font-semibold'>Inspector</h2>
        <p className='mt-1 text-[11px] leading-relaxed text-muted-foreground'>Click a node to inspect and edit it. Drag from a node&apos;s output port to another node&apos;s input port to connect them.</p>
      </Card>
    );
  }

  const shared = { node, onUpdate, onDuplicate, onDelete, parentTitle };

  if (node.type === 'group') {
    return <GroupInspector {...shared} memberCount={memberCount} onUngroup={onUngroup} onFitGroup={onFitGroup} onAddLane={onAddLane} />;
  }
  if (node.type === 'text') {
    return <TextInspector {...shared} />;
  }
  if (node.type === 'icon') {
    return <IconInspector {...shared} />;
  }
  return <BlockInspector {...shared} />;
}
