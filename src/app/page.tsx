'use client';

import { motion } from 'framer-motion';
import type { User } from 'firebase/auth';
import { Boxes, Hand, LayoutTemplate, ListOrdered, LoaderCircle, Play, RadioTower, Repeat2, RotateCcw, Save, SkipForward } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AuthLoadingScreen, LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/components/auth/AuthProvider';
import { UserMenu } from '@/components/auth/UserMenu';
import { DiagramManager } from '@/components/diagrams/DiagramManager';
import { JsonInspector } from '@/components/JsonInspector';
import { FlowCanvas } from '@/components/FlowCanvas';
import { EdgeInspector } from '@/components/EdgeInspector';
import { NodeInspector } from '@/components/NodeInspector';
import { ShapeToolbar } from '@/components/ShapeToolbar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { diagramTemplates, getDiagramTemplate, type DiagramTemplateId } from '@/lib/diagram-templates';
import { initialDocument } from '@/lib/flowchart-data';
import type { DiagramSettings, ExecutionState, FlowDocumentJSON, NodeShape, RunMode } from '@/lib/flowchart-types';
import { EDGE_DRAW_DURATION_MS, NODE_FADE_DURATION_MS } from '@/lib/execution-timing';
import { useEditor } from '@/lib/use-editor';
import { resolveNodeStyle } from '@/lib/node-style';
import { createDiagram, saveDiagram, type StoredDiagram } from '@/lib/firebase/diagrams';
import { loadEditorSession, saveEditorSession } from '@/lib/editor-session';

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

/** Inline editor for the diagram name in the header. Click to edit,
 *  Enter or blur commits, Escape cancels. */
function DiagramName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={80}
        aria-label='Diagram name'
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.target.select()}
        onBlur={() => {
          setEditing(false);
          const next = draft.trim();
          if (next && next !== name) onRename(next);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
          if (event.key === 'Escape') {
            setDraft(name);
            setEditing(false);
          }
        }}
        className='w-56 rounded-md border border-sky-400/40 bg-zinc-900/80 px-1.5 py-0.5 text-xs text-zinc-100 outline-none focus-visible:ring-2 focus-visible:ring-sky-400/15'
      />
    );
  }

  return (
    <button
      type='button'
      onClick={() => {
        setDraft(name);
        setEditing(true);
      }}
      title='Rename diagram'
      className='-mx-1 rounded px-1 text-xs text-zinc-400 transition hover:bg-white/6 hover:text-zinc-200'
    >
      {name}
    </button>
  );
}

function FlowEditor({ user }: { user: User }) {
  // Restores the diagram that was open before the last refresh (including
  // unsaved edits) instead of always booting into the default template.
  const [doc, setDoc] = useState<FlowDocumentJSON>(() => loadEditorSession(user.uid)?.doc ?? initialDocument);
  const [templateId, setTemplateId] = useState<DiagramTemplateId>('client-server-database');
  const [currentDiagramId, setCurrentDiagramId] = useState<string | null>(() => loadEditorSession(user.uid)?.currentDiagramId ?? null);
  const [currentDiagramName, setCurrentDiagramName] = useState(() => loadEditorSession(user.uid)?.currentDiagramName ?? 'Client / Server / Database');
  const [savedSignature, setSavedSignature] = useState<string | null>(() => loadEditorSession(user.uid)?.savedSignature ?? null);
  const [seed, setSeed] = useState(0);
  // Run mode + Repeat live inside doc.settings so they are saved to
  // Firebase with the diagram and restored on load / session restore.
  const runMode: RunMode = doc.settings?.runMode ?? 'sequential';
  const repeatEnabled = doc.settings?.repeatEnabled ?? false;
  const applyDiagramSettings = useCallback((patch: DiagramSettings) => {
    setDoc((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  }, []);
  const [runStep, setRunStep] = useState(0);
  const [runPhase, setRunPhase] = useState<RunPhase>('node');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [linkingFromId, setLinkingFromId] = useState<string | null>(null);
  const [activeShape, setActiveShape] = useState<NodeShape | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [savingDiagram, setSavingDiagram] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const hasSidebar = selectedNodeId !== null || selectedEdgeId !== null || infoOpen;

  const editor = useEditor(doc, setDoc);
  const documentSignature = useMemo(() => JSON.stringify(doc), [doc]);
  const dirty = savedSignature !== documentSignature;

  useEffect(() => {
    saveEditorSession(user.uid, { doc, currentDiagramId, currentDiagramName, savedSignature });
  }, [doc, currentDiagramId, currentDiagramName, savedSignature, user.uid]);
  // Nodes sharing the same resolved sort order animate together as one
  // step, rather than strictly one node at a time — order only expresses
  // "before/after", not "one by one".
  const orderedGroups = useMemo(() => {
    const resolved = doc.nodes
      .map((node, index) => ({
        node,
        order: node.sortOrder && node.sortOrder > 0 ? node.sortOrder : index + 1,
        index,
      }))
      .sort((a, b) => a.order - b.order || a.index - b.index);
    const groups: FlowDocumentJSON['nodes'][] = [];
    let lastOrder: number | null = null;
    for (const item of resolved) {
      const currentGroup = groups.at(-1);
      if (lastOrder === item.order && currentGroup) {
        currentGroup.push(item.node);
      } else {
        groups.push([item.node]);
        lastOrder = item.order;
      }
    }
    return groups;
  }, [doc.nodes]);
  const groupIndexByNodeId = useMemo(() => new Map(orderedGroups.flatMap((group, groupIndex) => group.map((node) => [node.id, groupIndex] as const))), [orderedGroups]);
  const active = useMemo(() => (runMode === 'concurrent' ? doc.nodes.map((node) => node.id) : runPhase === 'node' && orderedGroups[runStep] ? orderedGroups[runStep].map((node) => node.id) : []), [doc.nodes, orderedGroups, runMode, runPhase, runStep]);
  const nodeExecutionStates = useMemo(() => {
    if (runMode === 'concurrent') return undefined;
    return Object.fromEntries(
      orderedGroups.flatMap((group, groupIndex) => group.map((node) => [node.id, groupIndex < runStep || (groupIndex === runStep && runPhase === 'line') ? 'completed' : groupIndex === runStep && runPhase === 'node' ? 'active' : 'pending'])),
    ) as Record<string, ExecutionState>;
  }, [orderedGroups, runMode, runPhase, runStep]);
  const edgeExecutionStates = useMemo(() => {
    if (runMode === 'concurrent') {
      return Object.fromEntries(doc.edges.map((edge) => [edge.id, 'active'])) as Record<string, ExecutionState>;
    }
    return Object.fromEntries(
      doc.edges.map((edge) => {
        const fromOrder = groupIndexByNodeId.get(edge.from) ?? Number.MAX_SAFE_INTEGER;
        const toOrder = groupIndexByNodeId.get(edge.to) ?? Number.MAX_SAFE_INTEGER;
        const edgeStep = Math.max(fromOrder, toOrder);
        const reachedCurrentNode = runStep > 0 && edgeStep === runStep;
        const drawingNextLine = runPhase === 'line' && edgeStep === runStep + 1;
        const state: ExecutionState = edgeStep < runStep ? 'completed' : reachedCurrentNode || drawingNextLine ? 'active' : 'pending';
        return [edge.id, state];
      }),
    ) as Record<string, ExecutionState>;
  }, [doc.edges, groupIndexByNodeId, runMode, runPhase, runStep]);
  const runningEdgeIds = useMemo(() => (runMode === 'concurrent' ? null : doc.edges.filter((edge) => edgeExecutionStates?.[edge.id] === 'active').map((edge) => edge.id)), [doc.edges, edgeExecutionStates, runMode]);
  const currentTemplate = useMemo(() => getDiagramTemplate(templateId), [templateId]);

  // Shared by the sequential auto-timer and the manual mode's "Next" button
  // — both just move the same node/line cursor forward by one tick.
  const advanceStep = useCallback(() => {
    const reachedLastNode = runStep >= orderedGroups.length - 1 && runPhase === 'node';
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
  }, [runStep, runPhase, orderedGroups.length]);

  useEffect(() => {
    if (runMode !== 'sequential' || orderedGroups.length === 0) return;

    const reachedLastNode = runStep >= orderedGroups.length - 1 && runPhase === 'node';
    if (reachedLastNode && !repeatEnabled) return;

    const timer = window.setTimeout(advanceStep, reachedLastNode ? NODE_PHASE_MS + REPEAT_PAUSE_MS : runPhase === 'line' ? LINE_PHASE_MS : NODE_PHASE_MS);
    return () => window.clearTimeout(timer);
  }, [orderedGroups.length, repeatEnabled, runMode, runPhase, runStep, seed, advanceStep]);

  const selectedNode = useMemo(() => doc.nodes.find((n) => n.id === selectedNodeId) ?? null, [doc, selectedNodeId]);
  const selectedEdge = useMemo(() => doc.edges.find((edge) => edge.id === selectedEdgeId) ?? null, [doc, selectedEdgeId]);

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
  }, []);

  const resetCanvasState = useCallback(() => {
    setSeed((value) => value + 1);
    setRunStep(0);
    setRunPhase('node');
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setDraggingNodeId(null);
    setLinkingFromId(null);
    setActiveShape(null);
  }, []);

  const handleDiagramSaved = useCallback((diagramId: string, name: string, savedDocument: FlowDocumentJSON) => {
    setCurrentDiagramId(diagramId);
    setCurrentDiagramName(name);
    setSavedSignature(JSON.stringify(savedDocument));
  }, []);

  const handleSaveDiagram = useCallback(async () => {
    const nextName = currentDiagramName.trim();
    if (!nextName) {
      toast.error('Please name the diagram');
      return;
    }
    setSavingDiagram(true);
    try {
      let diagramId = currentDiagramId;
      if (diagramId) {
        await saveDiagram(user.uid, diagramId, nextName, doc);
      } else {
        diagramId = await createDiagram(user.uid, nextName, doc);
      }
      handleDiagramSaved(diagramId, nextName, doc);
      toast.success('Diagram saved', { description: nextName });
    } catch {
      toast.error('Could not save diagram', {
        description: 'You need to be signed in with write access for this UID.',
      });
    } finally {
      setSavingDiagram(false);
    }
  }, [currentDiagramName, currentDiagramId, doc, user.uid, handleDiagramSaved]);

  const handleDiagramLoaded = useCallback(
    (diagram: StoredDiagram) => {
      setDoc(diagram.document);
      setCurrentDiagramId(diagram.id);
      setCurrentDiagramName(diagram.name);
      setSavedSignature(JSON.stringify(diagram.document));
      resetCanvasState();
    },
    [resetCanvasState],
  );

  const handleDiagramDeleted = useCallback(
    (diagramId: string) => {
      if (diagramId !== currentDiagramId) return;
      setCurrentDiagramId(null);
      setSavedSignature(null);
    },
    [currentDiagramId],
  );

  return (
    <div className='flex h-screen flex-col bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100'>
      <header className='flex items-center justify-between border-b border-white/5 px-6 py-4'>
        <div className='flex items-center gap-3'>
          <div className='grid h-9 w-9 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/40'>
            <Boxes size={18} className='text-sky-300' />
          </div>
          <div>
            <h1 className='text-base font-semibold'>Flowgram Tools</h1>
            <DiagramName name={currentDiagramName} onRename={setCurrentDiagramName} />
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <Button onClick={handleSaveDiagram} disabled={savingDiagram} className='h-9 bg-cyan-300 text-zinc-950 hover:bg-cyan-200'>
            {savingDiagram ? <LoaderCircle className='animate-spin' /> : <Save />}
            {currentDiagramId ? 'Save' : 'Save as'}
            {dirty && <span className='size-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(180,83,9,.8)]' />}
          </Button>
          <DiagramManager userId={user.uid} currentDiagramId={currentDiagramId} onLoaded={handleDiagramLoaded} onDeleted={handleDiagramDeleted} />
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant='outline' className='h-9 border-white/10 bg-black/25 text-zinc-300 hover:bg-white/8' />}>
              <LayoutTemplate size={14} />
              Open templates
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-80 border-white/8 bg-zinc-950/95 p-1.5 backdrop-blur-xl'>
              <DropdownMenuGroup>
                <DropdownMenuLabel className='px-2 py-1.5'>Templates</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className='bg-white/8' />
              {diagramTemplates.map((template) => (
                <DropdownMenuItem key={template.id} onClick={() => loadTemplate(template.id)} className='flex-col items-start gap-0.5 px-2 py-2'>
                  <span className='flex w-full items-center justify-between gap-2 text-xs font-semibold text-zinc-100'>
                    {template.name}
                    <span className='shrink-0 font-mono text-[9px] font-normal text-zinc-600'>{template.document.nodes.length} blocks</span>
                  </span>
                  <span className='block truncate text-[10px] font-normal text-zinc-500'>
                    {template.category} · {template.description}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className='flex items-center rounded-lg bg-black/25 p-1 ring-1 ring-white/10' role='group' aria-label='Execution mode'>
            {(
              [
                { value: 'sequential', label: 'Sequential', Icon: ListOrdered },
                { value: 'concurrent', label: 'Concurrent', Icon: RadioTower },
                { value: 'manual', label: 'Manual', Icon: Hand },
              ] as const
            ).map((mode) => (
              <button
                key={mode.value}
                type='button'
                onClick={() => {
                  applyDiagramSettings({ runMode: mode.value });
                  setRunStep(0);
                  setRunPhase('node');
                  setSeed((value) => value + 1);
                }}
                aria-pressed={runMode === mode.value}
                className={[
                  'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-semibold transition',
                  runMode === mode.value ? 'bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-400/40' : 'text-zinc-500 hover:bg-white/6 hover:text-zinc-200',
                ].join(' ')}
              >
                <mode.Icon size={12} /> {mode.label}
              </button>
            ))}
          </div>
          <button
            type='button'
            disabled={runMode !== 'sequential'}
            onClick={() => applyDiagramSettings({ repeatEnabled: !repeatEnabled })}
            aria-pressed={repeatEnabled}
            title='Automatically replay after the sequential run completes'
            className={[
              'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[10px] font-semibold ring-1 transition',
              repeatEnabled && runMode === 'sequential' ? 'bg-emerald-400/15 text-emerald-100 ring-emerald-400/40' : 'bg-black/25 text-zinc-500 ring-white/10 hover:bg-white/6 hover:text-zinc-200',
              runMode !== 'sequential' ? 'cursor-not-allowed opacity-40 hover:bg-black/25 hover:text-zinc-500' : '',
            ].join(' ')}
          >
            <Repeat2 size={13} className={repeatEnabled && runMode === 'sequential' ? 'text-emerald-300' : ''} />
            Repeat
          </button>
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            type='button'
            onClick={() => {
              setRunStep(0);
              setRunPhase('node');
              setSeed((s) => s + 1);
            }}
            className='inline-flex h-9 items-center gap-1.5 rounded-md bg-sky-500/90 px-3 text-xs font-semibold text-sky-950 shadow-sm hover:bg-sky-400'
          >
            <Play size={14} />
            Replay path
          </motion.button>
          {runMode === 'manual' && (
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              type='button'
              onClick={advanceStep}
              disabled={orderedGroups.length === 0}
              title='Run the next step'
              className='inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-500/90 px-3 text-xs font-semibold text-emerald-950 shadow-sm hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40'
            >
              <SkipForward size={14} />
              Next
            </motion.button>
          )}
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            type='button'
            onClick={() => setResetConfirmOpen(true)}
            className='inline-flex h-9 items-center gap-1.5 rounded-md bg-white/5 px-3 text-xs font-semibold text-zinc-200 ring-1 ring-white/10 hover:bg-white/10'
          >
            <RotateCcw size={14} />
            Reset
          </motion.button>
          <UserMenu user={user} />
        </div>
      </header>

      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent className='border border-white/8 bg-zinc-950'>
          <AlertDialogHeader>
            <AlertDialogMedia className='bg-rose-400/10 text-rose-300'>
              <RotateCcw />
            </AlertDialogMedia>
            <AlertDialogTitle>Reset canvas?</AlertDialogTitle>
            <AlertDialogDescription>All unsaved changes on the current canvas will be lost and it will revert to the original template. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              onClick={() => {
                const template = getDiagramTemplate(templateId);
                setDoc(template.document);
                setCurrentDiagramId(null);
                setCurrentDiagramName(template.name);
                setSavedSignature(null);
                resetCanvasState();
                setResetConfirmOpen(false);
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <main className={['grid min-h-0 flex-1 gap-4 overflow-hidden', hasSidebar ? 'grid-cols-[1fr_320px]' : 'grid-cols-1'].join(' ')}>
        <section className='relative h-full min-h-0 overflow-hidden bg-zinc-950'>
          <FlowCanvas
            key={seed}
            document={doc}
            infoOpen={infoOpen}
            onToggleInfo={() => setInfoOpen((open) => !open)}
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
            isDragging={draggingNodeId !== null}
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
            onEdgeUpdate={editor.onEdgeUpdate}
            onSelectEdge={(id) => {
              setSelectedEdgeId(id);
              if (id) setSelectedNodeId(null);
            }}
            activeShape={activeShape}
            onShapeDrawn={(shape, position, width, height) => {
              const newId = editor.onShapeCreate(shape, position, width, height);
              if (newId) setSelectedNodeId(newId);
              // Figma-style: the tool disarms after each draw so a
              // single click doesn't accidentally produce a flood of
              // shapes. The user re-arms via the toolbar.
              setActiveShape(null);
            }}
          />
          <ShapeToolbar activeShape={activeShape} onSelect={setActiveShape} />
        </section>

        {hasSidebar && (
          <aside className='h-full min-h-0 overflow-hidden' aria-label='Editor inspector'>
            <ScrollArea className='h-full pr-1 [&_[data-slot=scroll-area-scrollbar]]:w-2 [&_[data-slot=scroll-area-thumb]]:bg-cyan-300/25'>
              <div className='flex min-h-full flex-col gap-3 pb-1'>
                {selectedNode && !selectedEdge && (
                  <NodeInspector
                    key={selectedNode.id}
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
                    sourceTitle={doc.nodes.find((node) => node.id === selectedEdge.from)?.title ?? selectedEdge.from}
                    targetTitle={doc.nodes.find((node) => node.id === selectedEdge.to)?.title ?? selectedEdge.to}
                    fallbackColor={doc.nodes.find((node) => node.id === selectedEdge.from) ? resolveNodeStyle(doc.nodes.find((node) => node.id === selectedEdge.from)!).foreground : '#67e8f9'}
                    onUpdate={editor.onEdgeUpdate}
                    onDelete={(id) => {
                      editor.onEdgeDelete(id);
                      setSelectedEdgeId(null);
                    }}
                    onClose={() => setSelectedEdgeId(null)}
                  />
                )}

                {infoOpen && (
                  <div className='rounded-xl bg-zinc-900/70 p-4 ring-1 ring-white/10'>
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <p className='text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-400'>{currentTemplate.category}</p>
                        <h2 className='mt-1 text-sm font-semibold'>{currentTemplate.name}</h2>
                      </div>
                      <div className='shrink-0 rounded-lg bg-white/5 px-2 py-1 text-right ring-1 ring-white/10'>
                        <div className='text-xs font-semibold text-zinc-200'>
                          {doc.nodes.length} / {doc.edges.length}
                        </div>
                        <div className='text-[8px] uppercase tracking-wider text-zinc-500'>blocks / lines</div>
                      </div>
                    </div>
                    <p className='mt-2 text-[11px] leading-relaxed text-zinc-400'>{currentTemplate.description}</p>
                    <p className='mt-3 text-[11px] leading-relaxed text-zinc-500'>
                      Choose another model from the library to replace the canvas. Every template remains fully editable: resize blocks, change shapes, reconnect nodes and customize line effects.
                    </p>
                  </div>
                )}

                {infoOpen && <JsonInspector value={JSON.stringify(doc, null, 2)} />}
              </div>
            </ScrollArea>
          </aside>
        )}
      </main>
    </div>
  );
}
