'use client';

import { motion } from 'framer-motion';
import type { User } from 'firebase/auth';
import { Boxes, ListOrdered, PlayCircle, RadioTower, Repeat2, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthLoadingScreen, LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/components/auth/AuthProvider';
import { UserMenu } from '@/components/auth/UserMenu';
import { DiagramManager } from '@/components/diagrams/DiagramManager';
import { JsonInspector } from '@/components/JsonInspector';
import { FlowCanvas } from '@/components/FlowCanvas';
import { EdgeInspector } from '@/components/EdgeInspector';
import { NodeInspector } from '@/components/NodeInspector';
import { NodePalette } from '@/components/NodePalette';
import { ModelSwitcher } from '@/components/ModelSwitcher';
import {
  diagramTemplates,
  getDiagramTemplate,
  type DiagramTemplateId,
} from '@/lib/diagram-templates';
import { initialDocument } from '@/lib/flowchart-data';
import type {
  ExecutionState,
  FlowDocumentJSON,
  NodePreset,
} from '@/lib/flowchart-types';
import {
  EDGE_DRAW_DURATION_MS,
  NODE_FADE_DURATION_MS,
} from '@/lib/execution-timing';
import { useEditor } from '@/lib/use-editor';
import { resolveNodeStyle } from '@/lib/node-style';
import type { StoredDiagram } from '@/lib/firebase/diagrams';

type RunMode = 'sequential' | 'concurrent';
type RunPhase = 'node' | 'line';

const NODE_PHASE_MS = NODE_FADE_DURATION_MS;
const LINE_PHASE_MS = EDGE_DRAW_DURATION_MS;
const REPEAT_PAUSE_MS = 800;

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) return <AuthLoadingScreen />;
  if (!user) return <LoginForm />;

  return <FlowEditor user={user} />;
}

function FlowEditor({ user }: { user: User }) {
  const [doc, setDoc] = useState<FlowDocumentJSON>(initialDocument);
  const [templateId, setTemplateId] = useState<DiagramTemplateId>('software-architecture');
  const [currentDiagramId, setCurrentDiagramId] = useState<string | null>(null);
  const [currentDiagramName, setCurrentDiagramName] = useState('Software Architecture');
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [seed, setSeed] = useState(0);
  const [runMode, setRunMode] = useState<RunMode>('sequential');
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [runStep, setRunStep] = useState(0);
  const [runPhase, setRunPhase] = useState<RunPhase>('node');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [linkingFromId, setLinkingFromId] = useState<string | null>(null);
  const [paletteDragPreset, setPaletteDragPreset] = useState<NodePreset | null>(null);

  const editor = useEditor(doc, setDoc);
  const documentSignature = useMemo(() => JSON.stringify(doc), [doc]);
  const dirty = savedSignature !== documentSignature;
  const orderedNodes = useMemo(
    () => doc.nodes
      .map((node, index) => ({ node, index }))
      .sort((a, b) => {
        const aOrder = a.node.sortOrder && a.node.sortOrder > 0
          ? a.node.sortOrder
          : a.index + 1;
        const bOrder = b.node.sortOrder && b.node.sortOrder > 0
          ? b.node.sortOrder
          : b.index + 1;
        return aOrder - bOrder || a.index - b.index;
      })
      .map(({ node }) => node),
    [doc.nodes],
  );
  const orderByNodeId = useMemo(
    () => new Map(orderedNodes.map((node, index) => [node.id, index])),
    [orderedNodes],
  );
  const active = useMemo(
    () => runMode === 'concurrent'
      ? doc.nodes.map((node) => node.id)
      : runPhase === 'node' && orderedNodes[runStep]
        ? [orderedNodes[runStep].id]
        : [],
    [doc.nodes, orderedNodes, runMode, runPhase, runStep],
  );
  const nodeExecutionStates = useMemo(() => {
    if (runMode === 'concurrent') return undefined;
    return Object.fromEntries(
      orderedNodes.map((node, index) => [
        node.id,
        index < runStep || (index === runStep && runPhase === 'line')
          ? 'completed'
          : index === runStep && runPhase === 'node'
            ? 'active'
            : 'pending',
      ]),
    ) as Record<string, ExecutionState>;
  }, [orderedNodes, runMode, runPhase, runStep]);
  const edgeExecutionStates = useMemo(() => {
    if (runMode === 'concurrent') {
      return Object.fromEntries(
        doc.edges.map((edge) => [edge.id, 'active']),
      ) as Record<string, ExecutionState>;
    }
    return Object.fromEntries(
      doc.edges.map((edge) => {
        const fromOrder = orderByNodeId.get(edge.from) ?? Number.MAX_SAFE_INTEGER;
        const toOrder = orderByNodeId.get(edge.to) ?? Number.MAX_SAFE_INTEGER;
        const edgeStep = Math.max(fromOrder, toOrder);
        const reachedCurrentNode = runStep > 0 && edgeStep === runStep;
        const drawingNextLine =
          runPhase === 'line' && edgeStep === runStep + 1;
        const state: ExecutionState = edgeStep < runStep
          ? 'completed'
          : reachedCurrentNode || drawingNextLine
            ? 'active'
            : 'pending';
        return [edge.id, state];
      }),
    ) as Record<string, ExecutionState>;
  }, [doc.edges, orderByNodeId, runMode, runPhase, runStep]);
  const runningEdgeIds = useMemo(
    () => runMode === 'concurrent'
      ? null
      : doc.edges
          .filter((edge) => edgeExecutionStates?.[edge.id] === 'active')
          .map((edge) => edge.id),
    [doc.edges, edgeExecutionStates, runMode],
  );
  const currentTemplate = useMemo(
    () => getDiagramTemplate(templateId),
    [templateId],
  );

  useEffect(() => {
    if (runMode !== 'sequential' || orderedNodes.length === 0) return;

    const reachedLastNode =
      runStep >= orderedNodes.length - 1 && runPhase === 'node';
    if (reachedLastNode && !repeatEnabled) return;

    const timer = window.setTimeout(() => {
      if (reachedLastNode) {
        setRunStep(0);
        setRunPhase('node');
        return;
      }
      if (runPhase === 'node') {
        setRunPhase('line');
      } else {
        setRunStep((step) => step + 1);
        setRunPhase('node');
      }
    }, reachedLastNode
      ? NODE_PHASE_MS + REPEAT_PAUSE_MS
      : runPhase === 'line'
        ? LINE_PHASE_MS
        : NODE_PHASE_MS);
    return () => window.clearTimeout(timer);
  }, [orderedNodes.length, repeatEnabled, runMode, runPhase, runStep, seed]);

  const selectedNode = useMemo(
    () => doc.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [doc, selectedNodeId],
  );
  const selectedEdge = useMemo(
    () => doc.edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [doc, selectedEdgeId],
  );

  const onPaletteDragStart = useCallback((preset: NodePreset) => {
    setPaletteDragPreset(preset);
  }, []);

  // The palette's drag end reports whether the pointer was released
  // over the canvas (via elementFromPoint hit-test). The canvas owns
  // the viewport→canvas coord translation, so it performs the drop.
  // Here we just clear palette state.
  const onPaletteDragEnd = useCallback(() => {
    setPaletteDragPreset(null);
  }, []);

  const loadTemplate = useCallback((id: DiagramTemplateId) => {
    const template = getDiagramTemplate(id);
    setTemplateId(id);
    setDoc(template.document);
    setCurrentDiagramId(null);
    setCurrentDiagramName(template.name);
    setSavedSignature(null);
    setSeed((value) => value + 1);
    setRunStep(0);
    setRunPhase('node');
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setDraggingNodeId(null);
    setLinkingFromId(null);
    setPaletteDragPreset(null);
  }, []);

  const resetCanvasState = useCallback(() => {
    setSeed((value) => value + 1);
    setRunStep(0);
    setRunPhase('node');
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setDraggingNodeId(null);
    setLinkingFromId(null);
    setPaletteDragPreset(null);
  }, []);

  const handleDiagramSaved = useCallback((
    diagramId: string,
    name: string,
    savedDocument: FlowDocumentJSON,
  ) => {
    setCurrentDiagramId(diagramId);
    setCurrentDiagramName(name);
    setSavedSignature(JSON.stringify(savedDocument));
  }, []);

  const handleDiagramLoaded = useCallback((diagram: StoredDiagram) => {
    setDoc(diagram.document);
    setCurrentDiagramId(diagram.id);
    setCurrentDiagramName(diagram.name);
    setSavedSignature(JSON.stringify(diagram.document));
    resetCanvasState();
  }, [resetCanvasState]);

  const handleDiagramDeleted = useCallback((diagramId: string) => {
    if (diagramId !== currentDiagramId) return;
    setCurrentDiagramId(null);
    setSavedSignature(null);
  }, [currentDiagramId]);

  const handleNewDiagram = useCallback(() => {
    setDoc(initialDocument);
    setTemplateId('software-architecture');
    setCurrentDiagramId(null);
    setCurrentDiagramName('Untitled Diagram');
    setSavedSignature(null);
    resetCanvasState();
  }, [resetCanvasState]);

  return (
    <div className="flex h-screen flex-col bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/40">
            <Boxes size={18} className="text-sky-300" />
          </div>
          <div>
            <h1 className="text-base font-semibold">Flowgram Tools</h1>
            <p className="text-xs text-zinc-400">
              {currentDiagramName}
              {dirty && <span className="ml-1.5 text-amber-300">• chưa lưu</span>}
            </p>
          </div>
        </div>

        <ModelSwitcher
          templates={diagramTemplates}
          value={templateId}
          onChange={loadTemplate}
        />

        <div className="flex items-center gap-2">
          <DiagramManager
            userId={user.uid}
            document={doc}
            currentDiagramId={currentDiagramId}
            currentName={currentDiagramName}
            dirty={dirty}
            onSaved={handleDiagramSaved}
            onLoaded={handleDiagramLoaded}
            onDeleted={handleDiagramDeleted}
            onNew={handleNewDiagram}
          />
          <div
            className="flex items-center rounded-lg bg-black/25 p-1 ring-1 ring-white/10"
            role="group"
            aria-label="Execution mode"
          >
            {([
              { value: 'sequential', label: 'Tuần tự', Icon: ListOrdered },
              { value: 'concurrent', label: 'Đồng thời', Icon: RadioTower },
            ] as const).map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => {
                  setRunMode(mode.value);
                  setRunStep(0);
                  setRunPhase('node');
                  setSeed((value) => value + 1);
                }}
                aria-pressed={runMode === mode.value}
                className={[
                  'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-semibold transition',
                  runMode === mode.value
                    ? 'bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-400/40'
                    : 'text-zinc-500 hover:bg-white/6 hover:text-zinc-200',
                ].join(' ')}
              >
                <mode.Icon size={12} /> {mode.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={runMode !== 'sequential'}
            onClick={() => setRepeatEnabled((enabled) => !enabled)}
            aria-pressed={repeatEnabled}
            title="Tự động chạy lại sau khi hoàn tất luồng tuần tự"
            className={[
              'inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-[10px] font-semibold ring-1 transition',
              repeatEnabled && runMode === 'sequential'
                ? 'bg-emerald-400/15 text-emerald-100 ring-emerald-400/40'
                : 'bg-black/25 text-zinc-500 ring-white/10 hover:bg-white/6 hover:text-zinc-200',
              runMode !== 'sequential'
                ? 'cursor-not-allowed opacity-40 hover:bg-black/25 hover:text-zinc-500'
                : '',
            ].join(' ')}
          >
            <Repeat2
              size={13}
              className={repeatEnabled && runMode === 'sequential' ? 'text-emerald-300' : ''}
            />
            Lặp
          </button>
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => {
              setRunStep(0);
              setRunPhase('node');
              setSeed((s) => s + 1);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/90 px-3 py-1.5 text-xs font-semibold text-sky-950 shadow-sm hover:bg-sky-400"
          >
            <PlayCircle size={14} />
            Replay path
          </motion.button>
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => {
              const template = getDiagramTemplate(templateId);
              setDoc(template.document);
              setCurrentDiagramId(null);
              setCurrentDiagramName(template.name);
              setSavedSignature(null);
              resetCanvasState();
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 ring-1 ring-white/10 hover:bg-white/10"
          >
            <RotateCcw size={14} />
            Reset
          </motion.button>
          <UserMenu user={user} />
        </div>
      </header>

      <main className="grid flex-1 grid-cols-[auto_1fr_320px] gap-4 overflow-hidden p-4">
        <NodePalette
          onDragStart={onPaletteDragStart}
          onDragMove={() => {
            /* canvas tracks pointer position via its own window listener */
          }}
          onDragEnd={onPaletteDragEnd}
          draggingPreset={paletteDragPreset}
        />

        <section className="relative h-full min-h-0 overflow-hidden rounded-2xl bg-zinc-950 ring-1 ring-white/10">
          <FlowCanvas
            key={seed}
            document={doc}
            activeNodeIds={active}
            runningEdgeIds={runningEdgeIds}
            nodeExecutionStates={nodeExecutionStates}
            edgeExecutionStates={edgeExecutionStates}
            selectedNodeId={selectedNodeId}
            onSelectNode={(id) => {
              setSelectedNodeId(id);
              if (id) setSelectedEdgeId(null);
            }}
            onNodeMove={editor.onNodeMove}
            onNodeResize={editor.onNodeUpdate}
            onNodeDragStart={(id) => setDraggingNodeId(id)}
            onNodeDragEnd={() => setDraggingNodeId(null)}
            onConnect={editor.onConnect}
            onPaletteDrop={(preset, pos) => {
              editor.onNodeCreate(preset, pos);
            }}
            isDragging={draggingNodeId !== null}
            isPaletteDragging={paletteDragPreset !== null}
            paletteDragPreset={paletteDragPreset}
            linkingFromId={linkingFromId}
            onLinkStart={(id) => setLinkingFromId(id)}
            onLinkMove={() => {
              /* canvas-side effect already updates the ghost via internal state */
            }}
            onLinkEnd={(toId) => {
              if (linkingFromId && toId && linkingFromId !== toId) {
                editor.onConnect(linkingFromId, toId);
              }
              setLinkingFromId(null);
            }}
            selectedEdgeId={selectedEdgeId}
            onEdgeReconnect={editor.onEdgeReconnect}
            onSelectEdge={(id) => {
              setSelectedEdgeId(id);
              if (id) setSelectedNodeId(null);
            }}
          />
        </section>

        <aside className="flex flex-col gap-3 overflow-y-auto pr-1">
          {!selectedEdge && (
            <NodeInspector
              key={selectedNode?.id ?? 'empty-inspector'}
              node={selectedNode}
              onUpdate={editor.onNodeUpdate}
              onDuplicate={(id) => {
                const duplicateId = editor.onNodeDuplicate(id);
                if (duplicateId) setSelectedNodeId(duplicateId);
              }}
              onDelete={(id) => {
                editor.onNodeDelete(id);
                setSelectedNodeId(null);
              }}
              onClose={() => setSelectedNodeId(null)}
            />
          )}

          {selectedEdge && (
            <EdgeInspector
              key={selectedEdge.id}
              edge={selectedEdge}
              sourceTitle={
                doc.nodes.find((node) => node.id === selectedEdge.from)?.title ??
                selectedEdge.from
              }
              targetTitle={
                doc.nodes.find((node) => node.id === selectedEdge.to)?.title ??
                selectedEdge.to
              }
              fallbackColor={
                doc.nodes.find((node) => node.id === selectedEdge.from)
                  ? resolveNodeStyle(
                      doc.nodes.find((node) => node.id === selectedEdge.from)!,
                    ).foreground
                  : '#67e8f9'
              }
              onUpdate={editor.onEdgeUpdate}
              onDelete={(id) => {
                editor.onEdgeDelete(id);
                setSelectedEdgeId(null);
              }}
              onClose={() => setSelectedEdgeId(null)}
            />
          )}

          <div className="rounded-xl bg-zinc-900/70 p-4 ring-1 ring-white/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-400">
                  {currentTemplate.category}
                </p>
                <h2 className="mt-1 text-sm font-semibold">{currentTemplate.name}</h2>
              </div>
              <div className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-right ring-1 ring-white/10">
                <div className="text-xs font-semibold text-zinc-200">
                  {doc.nodes.length} / {doc.edges.length}
                </div>
                <div className="text-[8px] uppercase tracking-wider text-zinc-500">
                  blocks / lines
                </div>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
              {currentTemplate.description}
            </p>
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
              Choose another model from the library to replace the canvas.
              Every template remains fully editable: resize blocks, change
              shapes, reconnect nodes and customize line effects.
            </p>
          </div>

          <JsonInspector value={JSON.stringify(doc, null, 2)} />
        </aside>
      </main>

      <footer className="border-t border-white/5 px-6 py-3 text-[11px] text-zinc-500">
        Built with Next.js · @flowgram.ai/editor · framer-motion · lucide-react
      </footer>
    </div>
  );
}
