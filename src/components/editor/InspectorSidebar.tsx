'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { EdgeInspector } from '@/components/EdgeInspector';
import { JsonInspector } from '@/components/JsonInspector';
import { JsonPlaygroundPanel } from '@/components/editor/JsonPlaygroundPanel';
import { NodeInspector } from '@/components/NodeInspector';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEditorStore } from '@/lib/editor-store';
import type { FlowDocumentJSON } from '@/lib/flowchart-types';
import { resolveNodeStyle } from '@/lib/node-style';

/**
 * Right-hand inspector column. Node and edge inspectors are identical on
 * every editing surface; `children` carries whatever info panels that
 * surface wants below them (rendered only while Info is toggled on).
 */
export function InspectorSidebar({ document, ariaLabel, children }: { document: FlowDocumentJSON; ariaLabel: string; children?: ReactNode }) {
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedEdgeId = useEditorStore((state) => state.selectedEdgeId);
  const { selectNode, selectEdge, onNodeUpdate, onNodeDuplicate, onNodeDelete, onEdgeUpdate, onEdgeDelete } = useEditorStore();

  const selectedNode = document.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = document.edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const edgeSource = selectedEdge ? document.nodes.find((node) => node.id === selectedEdge.from) : undefined;

  return (
    <aside className='h-full min-h-0 overflow-hidden' aria-label={ariaLabel}>
      <ScrollArea className='h-full pr-1 [&_[data-slot=scroll-area-scrollbar]]:w-2 [&_[data-slot=scroll-area-thumb]]:bg-cyan-300/25'>
        {/* Gentle slide-in each time the panel appears (the whole aside
            mounts when something becomes selected). */}
        <motion.div initial={{ x: 18, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.24, ease: 'easeOut' }} className='flex min-h-full flex-col gap-3 pb-1'>
          {selectedNode && !selectedEdge && (
            <NodeInspector
              key={selectedNode.id}
              node={selectedNode}
              onUpdate={onNodeUpdate}
              onDuplicate={(id) => {
                const duplicateId = onNodeDuplicate(id);
                if (duplicateId) selectNode(duplicateId);
              }}
              onDelete={(id) => {
                onNodeDelete(id);
                selectNode(null);
              }}
              onClose={() => selectNode(null)}
            />
          )}

          {selectedEdge && (
            <EdgeInspector
              key={selectedEdge.id}
              edge={selectedEdge}
              sourceTitle={edgeSource?.title ?? selectedEdge.from}
              targetTitle={document.nodes.find((node) => node.id === selectedEdge.to)?.title ?? selectedEdge.to}
              fallbackColor={edgeSource ? resolveNodeStyle(edgeSource).foreground : '#67e8f9'}
              onUpdate={onEdgeUpdate}
              onDelete={(id) => {
                onEdgeDelete(id);
                selectEdge(null);
              }}
              onClose={() => selectEdge(null)}
            />
          )}

          {children}
        </motion.div>
      </ScrollArea>
    </aside>
  );
}

/**
 * Everything the Info toggle reveals: the document summary, the live
 * JSON view and the JSON playground. Only `note` differs per surface,
 * so both editors get the same three panels in the same order.
 */
export function EditorInfoPanels({ category, title, description, note, document }: { category: string; title: string; description: string; note: ReactNode; document: FlowDocumentJSON }) {
  return (
    <>
      <InfoPanel category={category} title={title} description={description} document={document}>
        <p className='mt-3 text-[11px] leading-relaxed text-zinc-500'>{note}</p>
      </InfoPanel>
      <JsonInspector value={JSON.stringify(document, null, 2)} />
      <JsonPlaygroundPanel document={document} />
    </>
  );
}

/** Header block of an Info panel: category, title, block/line counts. */
function InfoPanel({ category, title, description, document, children }: { category: string; title: string; description: string; document: FlowDocumentJSON; children?: ReactNode }) {
  return (
    <div className='rounded-xl bg-zinc-900/70 py-3 pr-3 pl-1'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <p className='text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-400'>{category}</p>
          <h2 className='mt-1 text-sm font-semibold'>{title}</h2>
        </div>
        <div className='shrink-0 rounded-lg bg-white/5 px-2 py-1 text-right ring-1 ring-white/10'>
          <div className='text-xs font-semibold text-zinc-200'>
            {document.nodes.length} / {document.edges.length}
          </div>
          <div className='text-[8px] uppercase tracking-wider text-zinc-500'>blocks / lines</div>
        </div>
      </div>
      <p className='mt-2 text-[11px] leading-relaxed text-zinc-400'>{description}</p>
      {children}
    </div>
  );
}
