'use client';

import type { FlowNode } from '@/lib/flowchart-types';
import { BlockInspector } from './BlockInspector';
import { GroupInspector } from './GroupInspector';
import { IconInspector } from './IconInspector';
import { LineInspector } from './LineInspector';
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
}

/**
 * Picks the inspector panel for the selected node.
 *
 * The kinds paint genuinely different things — a block has a body, a
 * text object has only words, a frame has a wash and a title bar, a free
 * icon/logo object has only a glyph, a free line has only a stroke — so
 * each gets its own panel rather than one panel full of guards. Anything
 * two of them share lives in `./fields`.
 */
export function NodeInspector({ node, onUpdate, onDuplicate, onDelete, memberCount = 0, parentTitle = null, onUngroup, onFitGroup }: NodeInspectorProps) {
  if (!node) {
    return (
      <section className='px-4 py-3'>
        <p className='text-[11px] leading-relaxed text-muted-foreground'>Click a node to inspect and edit it. Drag from a node&apos;s output port to another node&apos;s input port to connect them.</p>
      </section>
    );
  }

  const shared = { node, onUpdate, onDuplicate, onDelete, parentTitle };

  if (node.type === 'group') {
    return <GroupInspector {...shared} memberCount={memberCount} onUngroup={onUngroup} onFitGroup={onFitGroup} />;
  }
  if (node.type === 'text') {
    return <TextInspector {...shared} />;
  }
  if (node.type === 'icon') {
    return <IconInspector {...shared} />;
  }
  if (node.type === 'line') {
    return <LineInspector {...shared} />;
  }
  return <BlockInspector {...shared} />;
}
