'use client';

import { useState, type ReactNode } from 'react';
import { EdgeInspector } from '@/components/EdgeInspector';
import { JsonInspector } from '@/components/JsonInspector';
import { JsonPlaygroundPanel } from '@/components/editor/JsonPlaygroundPanel';
import { NodeInspector } from '@/components/inspector/NodeInspector';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EdgeStylePaletteDialog } from '@/components/editor/EdgeStylePaletteDialog';
import { useEditorStore } from '@/lib/editor-store';
import { edgeStylesOf } from '@/lib/edge-style';
import type { FlowDocumentJSON } from '@/lib/flowchart-types';
import { resolveNodeStyle } from '@/lib/node-style';

/**
 * Right-hand inspector, rendered as a non-modal drawer that floats over
 * the canvas so the canvas keeps its full width and stays clickable while
 * you edit. Node and edge inspectors are identical on every editing
 * surface; `children` carries whatever info panels that surface wants
 * below them (rendered only while Info is toggled on).
 */
export function InspectorSidebar({ document, ariaLabel, children }: { document: FlowDocumentJSON; ariaLabel: string; children?: ReactNode }) {
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedEdgeId = useEditorStore((state) => state.selectedEdgeId);
  const infoOpen = useEditorStore((state) => state.infoOpen);
  const { selectNode, selectEdge, toggleInfo, onNodeUpdate, onNodeDuplicate, onNodeDelete, onEdgeUpdate, onEdgeDelete, assignEdgeStyle, ungroupNode, fitGroupToContents, addLaneAfter } = useEditorStore();
  const [stylePaletteOpen, setStylePaletteOpen] = useState(false);

  const selectedNode = document.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = document.edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const edgeSource = selectedEdge ? document.nodes.find((node) => node.id === selectedEdge.from) : undefined;

  return (
    <Drawer
      open={selectedNode !== null || selectedEdge !== null || infoOpen}
      // Escape and the swipe gesture dismiss the whole inspector; clearing
      // both selections and Info is what actually drives `open` back to false.
      onOpenChange={(next) => {
        if (next) return;
        selectNode(null);
        selectEdge(null);
        if (infoOpen) toggleInfo();
      }}
      modal={false}
      // Without this, every click on the canvas (selecting the next node)
      // counts as an outside press and races the new selection.
      disablePointerDismissal
      swipeDirection='right'
    >
      <DrawerContent aria-label={ariaLabel}>
        <ScrollArea className='h-full pr-1 [&_[data-slot=scroll-area-scrollbar]]:w-2 [&_[data-slot=scroll-area-thumb]]:bg-cyan-300/25'>
          <div className='flex min-h-full flex-col gap-3 p-2'>
            {selectedNode && !selectedEdge && (
              <NodeInspector
                key={selectedNode.id}
                node={selectedNode}
                memberCount={document.nodes.filter((node) => node.parentId === selectedNode.id).length}
                parentTitle={selectedNode.parentId ? (document.nodes.find((node) => node.id === selectedNode.parentId)?.title ?? null) : null}
                onUngroup={ungroupNode}
                onFitGroup={fitGroupToContents}
                onAddLane={(id) => {
                  const laneId = addLaneAfter(id);
                  if (laneId) selectNode(laneId);
                }}
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
                styles={edgeStylesOf(document.settings)}
                sourceNode={edgeSource}
                targetNode={document.nodes.find((node) => node.id === selectedEdge.to)}
                sourceTitle={edgeSource?.title ?? selectedEdge.from}
                targetTitle={document.nodes.find((node) => node.id === selectedEdge.to)?.title ?? selectedEdge.to}
                fallbackColor={edgeSource ? resolveNodeStyle(edgeSource).foreground : '#67e8f9'}
                sourceColumns={edgeSource?.table?.columns}
                targetColumns={document.nodes.find((node) => node.id === selectedEdge.to)?.table?.columns}
                onUpdate={onEdgeUpdate}
                onAssignStyle={assignEdgeStyle}
                onManageStyles={() => setStylePaletteOpen(true)}
                onDelete={(id) => {
                  onEdgeDelete(id);
                  selectEdge(null);
                }}
                onClose={() => selectEdge(null)}
              />
            )}

            {children}
          </div>
        </ScrollArea>
      </DrawerContent>

      {/* Mounted from the sidebar rather than inside `EdgeInspector` so
          the palette survives the line being deselected while it's open
          — the inspector unmounts the moment the selection clears. */}
      <EdgeStylePaletteDialog open={stylePaletteOpen} onOpenChange={setStylePaletteOpen} />
    </Drawer>
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
        <p className='mt-3 text-[11px] leading-relaxed text-muted-foreground'>{note}</p>
      </InfoPanel>
      <JsonInspector value={JSON.stringify(document, null, 2)} />
      <JsonPlaygroundPanel document={document} />
    </>
  );
}

/** Header block of an Info panel: category, title, block/line counts. */
function InfoPanel({ category, title, description, document, children }: { category: string; title: string; description: string; document: FlowDocumentJSON; children?: ReactNode }) {
  return (
    <div className='rounded-xl bg-card py-3 pr-3 pl-1'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <p className='text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400'>{category}</p>
          <h2 className='mt-1 text-sm font-semibold'>{title}</h2>
        </div>
        <div className='shrink-0 rounded-lg bg-accent px-2 py-1 text-right ring-1 ring-border'>
          <div className='text-xs font-semibold text-accent-foreground'>
            {document.nodes.length} / {document.edges.length}
          </div>
          <div className='text-[8px] uppercase tracking-wider text-muted-foreground'>blocks / lines</div>
        </div>
      </div>
      <p className='mt-2 text-[11px] leading-relaxed text-muted-foreground'>{description}</p>
      {children}
    </div>
  );
}
