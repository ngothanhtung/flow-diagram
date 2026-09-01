'use client';

import { FlowCanvas } from '@/components/FlowCanvas';
import { ShapeToolbar } from '@/components/ShapeToolbar';
import { SelectionToolbar } from '@/components/editor/SelectionToolbar';
import { useEditorStore } from '@/lib/editor-store';
import type { ExecutionState, FlowDocumentJSON } from '@/lib/flowchart-types';

interface EditorCanvasProps {
  document: FlowDocumentJSON;
  activeNodeIds: string[];
  runningEdgeIds: string[] | null;
  nodeExecutionStates: Record<string, ExecutionState> | undefined;
  edgeExecutionStates: Record<string, ExecutionState>;
  effectsPaused: boolean;
}

/**
 * Canvas + shape dock, wired to the editor store. Every editing surface
 * (diagram editor, template editor) mounts this instead of repeating the
 * ~40 props `FlowCanvas` needs, so a change to canvas behaviour lands in
 * both places at once.
 */
export function EditorCanvas({ document, activeNodeIds, runningEdgeIds, nodeExecutionStates, edgeExecutionStates, effectsPaused }: EditorCanvasProps) {
  const seed = useEditorStore((state) => state.seed);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const selectedEdgeId = useEditorStore((state) => state.selectedEdgeId);
  const draggingNodeId = useEditorStore((state) => state.draggingNodeId);
  const linkingFromId = useEditorStore((state) => state.linkingFromId);
  const activeShape = useEditorStore((state) => state.activeShape);
  const infoOpen = useEditorStore((state) => state.infoOpen);

  const { selectNode, toggleNodeSelection, selectNodes, selectEdge, setDraggingNodeId, setLinkingFromId, setActiveShape, toggleInfo, onNodeMove, onNodeDrop, onNodeUpdate, onConnect, onShapeCreate, onEdgeUpdate, onEdgeReconnect } = useEditorStore();

  return (
    <section className='relative h-full min-h-0 overflow-hidden bg-background'>
      <FlowCanvas
        key={seed}
        document={document}
        infoOpen={infoOpen}
        onToggleInfo={toggleInfo}
        activeNodeIds={activeNodeIds}
        runningEdgeIds={runningEdgeIds}
        nodeExecutionStates={nodeExecutionStates}
        edgeExecutionStates={edgeExecutionStates}
        effectsPaused={effectsPaused}
        selectedNodeId={selectedNodeId}
        selectedNodeIds={selectedNodeIds}
        onSelectNode={selectNode}
        onToggleNodeSelection={toggleNodeSelection}
        onSelectNodes={selectNodes}
        onNodeMove={onNodeMove}
        onNodeResize={onNodeUpdate}
        onNodeDragStart={(id) => setDraggingNodeId(id)}
        onNodeDragEnd={(id) => {
          setDraggingNodeId(null);
          // Where it landed decides which group frame it belongs to.
          onNodeDrop(id);
        }}
        onConnect={onConnect}
        isDragging={draggingNodeId !== null}
        linkingFromId={linkingFromId}
        onLinkStart={(id) => setLinkingFromId(id)}
        onLinkMove={() => {
          /* canvas-side effect already updates the ghost via internal state */
        }}
        onLinkEnd={(toId) => {
          if (linkingFromId && toId && linkingFromId !== toId) {
            onConnect(linkingFromId, toId);
          }
          setLinkingFromId(null);
        }}
        selectedEdgeId={selectedEdgeId}
        onEdgeReconnect={onEdgeReconnect}
        onEdgeUpdate={onEdgeUpdate}
        onSelectEdge={selectEdge}
        activeShape={activeShape}
        onShapeDrawn={(shape, position, width, height) => {
          const newId = onShapeCreate(shape, position, width, height);
          if (newId) selectNode(newId);
          // Figma-style: the tool disarms after each draw so a single
          // click doesn't accidentally produce a flood of shapes. The
          // user re-arms via the toolbar.
          setActiveShape(null);
        }}
      />
      <ShapeToolbar activeShape={activeShape} onSelect={setActiveShape} />
      <SelectionToolbar />
    </section>
  );
}
