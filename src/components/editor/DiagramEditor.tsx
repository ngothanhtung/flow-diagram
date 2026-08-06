'use client';

import { motion } from 'framer-motion';
import { Boxes, Copy, FileJson, FilePlus, FileQuestion, FlaskConical, FolderOpen, Globe, Hand, LayoutTemplate, ListOrdered, LoaderCircle, LockKeyhole, Play, RadioTower, Repeat2, RotateCcw, Save, Share2, SkipForward, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from '@/components/ui/navigation-menu';
import { AuthLoadingScreen, LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/components/auth/AuthProvider';
import { UserMenu } from '@/components/auth/UserMenu';
import { ShareDialog } from '@/components/diagrams/ShareDialog';
import { JsonInspector } from '@/components/JsonInspector';
import { FlowCanvas } from '@/components/FlowCanvas';
import { EdgeInspector } from '@/components/EdgeInspector';
import { NodeInspector } from '@/components/NodeInspector';
import { ShapeToolbar } from '@/components/ShapeToolbar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { diagramTemplates, getDiagramTemplate } from '@/lib/diagram-templates';
import type { ExecutionState, FlowDocumentJSON } from '@/lib/flowchart-types';
import { EDGE_DRAW_DURATION_MS, NODE_FADE_DURATION_MS } from '@/lib/execution-timing';
import { computeOrderedGroups, useEditorStore } from '@/lib/editor-store';
import { resolveNodeStyle } from '@/lib/node-style';
import { createDiagram, loadDiagram, saveDiagram } from '@/lib/firebase/diagrams';
import { listTemplates, type StoredTemplate } from '@/lib/firebase/templates';
import { saveEditorSession } from '@/lib/editor-session';

const NODE_PHASE_MS = NODE_FADE_DURATION_MS;
const LINE_PHASE_MS = EDGE_DRAW_DURATION_MS;
const REPEAT_PAUSE_MS = 800;

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

/**
 * Full editor for one diagram at `/diagrams/{id}/edit`. The document is
 * fetched from `users/{uid}/diagrams/{id}` — only the owner can open it
 * here (the read goes through their own uid path). If a session with
 * the same diagram id is restored first, its unsaved edits are kept.
 */
export function DiagramEditor({ diagramId }: { diagramId: string }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [status, setStatus] = useState<'loading' | 'not-found' | 'error'>('loading');

  // All global editor state lives in the zustand store. Hydrate from the
  // localStorage session exactly once. This has to run in a layout effect
  // rather than directly in the render body — mutating the store mid-render
  // trips React's "setState while rendering a different component" guard.
  // A layout effect still resolves before paint, so this never causes a
  // visible flash.
  useLayoutEffect(() => {
    if (!user) return;
    const state = useEditorStore.getState();
    if (!state.hydrated) state.hydrate(user.uid);
  }, [user]);

  const doc = useEditorStore((state) => state.doc);
  const templateId = useEditorStore((state) => state.templateId);
  const loadedTemplate = useEditorStore((state) => state.loadedTemplate);
  const hydrated = useEditorStore((state) => state.hydrated);
  const currentDiagramId = useEditorStore((state) => state.currentDiagramId);
  // A session that already restored this exact diagram (unsaved edits
  // included) is ready as soon as the store hydrates — no Firestore fetch.
  const effectiveStatus = hydrated && currentDiagramId === diagramId ? 'ready' : status;
  const currentDiagramName = useEditorStore((state) => state.currentDiagramName);
  const currentDiagramPublic = useEditorStore((state) => state.currentDiagramPublic);
  const savedSignature = useEditorStore((state) => state.savedSignature);
  const savingDiagram = useEditorStore((state) => state.savingDiagram);
  const seed = useEditorStore((state) => state.seed);
  const runStep = useEditorStore((state) => state.runStep);
  const runPhase = useEditorStore((state) => state.runPhase);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedEdgeId = useEditorStore((state) => state.selectedEdgeId);
  const draggingNodeId = useEditorStore((state) => state.draggingNodeId);
  const linkingFromId = useEditorStore((state) => state.linkingFromId);
  const activeShape = useEditorStore((state) => state.activeShape);
  const infoOpen = useEditorStore((state) => state.infoOpen);

  const {
    renameDiagram,
    setDiagramPublic,
    markDiagramSaved,
    loadStoredDiagram,
    loadTemplate,
    loadRemoteTemplate,
    resetToTemplate,
    applySettings,
    replay,
    advanceStep,
    selectNode,
    selectEdge,
    setDraggingNodeId,
    setLinkingFromId,
    setActiveShape,
    toggleInfo,
    setSavingDiagram,
    onNodeMove,
    onNodeUpdate,
    onNodeDuplicate,
    onNodeDelete,
    onConnect,
    onShapeCreate,
    onEdgeDelete,
    onEdgeUpdate,
    onEdgeReconnect,
  } = useEditorStore();

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [savingAs, setSavingAs] = useState(false);
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  const [jsonDraft, setJsonDraft] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Load the route's diagram into the store — unless the session already
  // restored this exact diagram, in which case unsaved edits are kept.
  useEffect(() => {
    if (!user) return;
    const state = useEditorStore.getState();
    if (state.hydrated && state.currentDiagramId === diagramId) return;
    let cancelled = false;
    loadDiagram(user.uid, diagramId)
      .then((diagram) => {
        if (cancelled) return;
        if (!diagram) {
          setStatus('not-found');
          return;
        }
        loadStoredDiagram(diagram);
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [diagramId, user, loadStoredDiagram]);

  const hasSidebar = selectedNodeId !== null || selectedEdgeId !== null || infoOpen || playgroundOpen;

  // Run mode + Repeat live inside doc.settings so they are saved to
  // Firebase with the diagram and restored on load / session restore.
  const runMode = doc.settings?.runMode ?? 'sequential';
  const repeatEnabled = doc.settings?.repeatEnabled ?? false;
  const documentSignature = useMemo(() => JSON.stringify(doc), [doc]);
  const dirty = savedSignature !== documentSignature;

  useEffect(() => {
    if (!user) return;
    saveEditorSession(user.uid, { doc, currentDiagramId, currentDiagramName, currentDiagramPublic, savedSignature });
  }, [doc, currentDiagramId, currentDiagramName, currentDiagramPublic, savedSignature, user]);
  const orderedGroups = useMemo(() => computeOrderedGroups(doc.nodes), [doc.nodes]);
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
  const currentTemplate = useMemo(() => loadedTemplate ?? getDiagramTemplate(templateId), [loadedTemplate, templateId]);

  // The template library lives in Firestore (`templates` collection,
  // managed at /admin/templates). Falls back to the built-in templates
  // when the shared library is empty or unreachable.
  const [remoteTemplates, setRemoteTemplates] = useState<StoredTemplate[]>([]);
  useEffect(() => {
    let cancelled = false;
    listTemplates()
      .then((templates) => {
        if (!cancelled) setRemoteTemplates(templates);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const templateItems = useMemo(
    () =>
      remoteTemplates.length > 0
        ? remoteTemplates.map((template) => ({
            id: template.id,
            name: template.name,
            category: template.category ?? 'General',
            description: template.description ?? '',
            nodeCount: template.document?.nodes?.length ?? 0,
            onSelect: () =>
              loadRemoteTemplate({
                name: template.name,
                category: template.category ?? 'General',
                description: template.description ?? '',
                document: template.document ?? { nodes: [], edges: [] },
              }),
          }))
        : diagramTemplates.map((template) => ({
            id: template.id,
            name: template.name,
            category: template.category,
            description: template.description,
            nodeCount: template.document.nodes.length,
            onSelect: () => loadTemplate(template.id),
          })),
    [remoteTemplates, loadRemoteTemplate, loadTemplate],
  );

  useEffect(() => {
    if (runMode !== 'sequential' || orderedGroups.length === 0) return;

    const reachedLastNode = runStep >= orderedGroups.length - 1 && runPhase === 'node';
    if (reachedLastNode && !repeatEnabled) return;

    const timer = window.setTimeout(advanceStep, reachedLastNode ? NODE_PHASE_MS + REPEAT_PAUSE_MS : runPhase === 'line' ? LINE_PHASE_MS : NODE_PHASE_MS);
    return () => window.clearTimeout(timer);
  }, [orderedGroups.length, repeatEnabled, runMode, runPhase, runStep, seed, advanceStep]);

  const selectedNode = useMemo(() => doc.nodes.find((n) => n.id === selectedNodeId) ?? null, [doc, selectedNodeId]);
  const selectedEdge = useMemo(() => doc.edges.find((edge) => edge.id === selectedEdgeId) ?? null, [doc, selectedEdgeId]);

  const handleSaveDiagram = useCallback(async () => {
    if (!user) return;
    const nextName = currentDiagramName.trim();
    if (!nextName) {
      toast.error('Please name the diagram');
      return;
    }
    setSavingDiagram(true);
    try {
      await saveDiagram(user.uid, diagramId, nextName, doc, currentDiagramPublic);
      markDiagramSaved(diagramId, nextName, doc);
      toast.success('Diagram saved', { description: nextName });
    } catch {
      toast.error('Could not save diagram', {
        description: 'You need to be signed in with write access for this UID.',
      });
    } finally {
      setSavingDiagram(false);
    }
  }, [user, diagramId, currentDiagramName, currentDiagramPublic, doc, markDiagramSaved, setSavingDiagram]);

  const handleNewDiagram = useCallback(async () => {
    if (!user) return;
    try {
      const id = await createDiagram(user.uid, 'Untitled diagram', { nodes: [], edges: [] }, false);
      router.push(`/diagrams/${id}/edit`);
    } catch {
      toast.error('Could not create diagram', { description: 'Check sign-in and Firestore rules.' });
    }
  }, [user, router]);

  const handleSaveAs = useCallback(async () => {
    if (!user) return;
    const nextName = `${currentDiagramName.trim() || 'Untitled diagram'} copy`;
    setSavingAs(true);
    try {
      const id = await createDiagram(user.uid, nextName, doc, false);
      toast.success('Saved as a new diagram', { description: nextName });
      router.push(`/diagrams/${id}/edit`);
    } catch {
      toast.error('Could not save as a new diagram', { description: 'Check sign-in and Firestore rules.' });
    } finally {
      setSavingAs(false);
    }
  }, [user, currentDiagramName, doc, router]);

  // Playground: parses/validates a pasted FlowDocumentJSON (same rules as
  // /guide's checklist — unique node ids, edges referencing real nodes)
  // and, if valid, replaces the canvas via the same path a template load
  // uses, so Reset/dirty-tracking behave exactly as they do for a template.
  const handleRenderJson = useCallback(() => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonDraft);
    } catch (err) {
      setJsonError(`Invalid JSON: ${(err as Error).message}`);
      return;
    }
    if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as { nodes?: unknown }).nodes) || !Array.isArray((parsed as { edges?: unknown }).edges)) {
      setJsonError('Document must be an object with "nodes" and "edges" arrays.');
      return;
    }
    const document = parsed as FlowDocumentJSON;
    const nodeIds = new Set<string>();
    for (const node of document.nodes) {
      if (!node || typeof node.id !== 'string' || !node.id) {
        setJsonError('Every node needs a non-empty string "id".');
        return;
      }
      if (nodeIds.has(node.id)) {
        setJsonError(`Duplicate node id "${node.id}".`);
        return;
      }
      if (!node.type || !node.title || !node.position) {
        setJsonError(`Node "${node.id}" is missing "type", "title", or "position".`);
        return;
      }
      nodeIds.add(node.id);
    }
    for (const edge of document.edges) {
      if (!edge || typeof edge.id !== 'string' || !edge.id) {
        setJsonError('Every edge needs a non-empty string "id".');
        return;
      }
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
        setJsonError(`Edge "${edge.id}" references a node id that doesn't exist ("${edge.from}" → "${edge.to}").`);
        return;
      }
    }
    setJsonError(null);
    loadRemoteTemplate({ name: 'Pasted JSON', category: 'Playground', description: 'Rendered from the JSON playground panel.', document });
    toast.success('Rendered pasted JSON', { description: `${document.nodes.length} nodes, ${document.edges.length} edges` });
  }, [jsonDraft, loadRemoteTemplate]);

  const handleExportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(currentDiagramName.trim() || 'diagram').replace(/[^a-z0-9-_]+/gi, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [doc, currentDiagramName]);

  if (loading) return <AuthLoadingScreen />;
  if (!user) return <LoginForm />;

  if (effectiveStatus !== 'ready') {
    return (
      <div className='grid h-screen place-items-center bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100'>
        <div className='flex max-w-sm flex-col items-center gap-4 rounded-xl bg-zinc-900/70 px-8 py-10 text-center'>
          <div className='grid size-12 place-items-center rounded-full bg-sky-500/15 ring-1 ring-sky-400/40'>
            {status === 'loading' ? <LoaderCircle size={22} className='animate-spin text-sky-300' /> : <FileQuestion size={22} className='text-sky-300' />}
          </div>
          <div>
            <h1 className='text-sm font-semibold'>{status === 'loading' ? 'Loading diagram…' : status === 'not-found' ? 'Diagram not found' : 'Could not load diagram'}</h1>
            <p className='mt-1.5 text-xs leading-relaxed text-zinc-500'>
              {status === 'loading' ? `Opening ${diagramId}.` : status === 'not-found' ? 'You do not have a diagram with this id. Only the owner can edit a diagram.' : 'Check your connection and try again.'}
            </p>
          </div>
          <Link href='/' className='inline-flex h-8 items-center gap-1.5 rounded-md bg-white/5 px-3 text-xs font-semibold text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10'>
            Back to diagrams
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-screen flex-col bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100'>
      <header className='flex items-center justify-between border-b border-white/5 px-6 py-4'>
        <div className='flex items-center gap-3'>
          <div className='grid h-9 w-9 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/40'>
            <Boxes size={18} className='text-sky-300' />
          </div>
          <div>
            <h1 className='text-base font-semibold'>X Flow Tool</h1>
            <DiagramName name={currentDiagramName} onRename={renameDiagram} />
          </div>
          <NavigationMenu className='max-w-none'>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className='h-9 gap-1.5 rounded-lg border border-white/10 bg-black/25 px-3 text-xs font-semibold text-zinc-300 hover:bg-white/8 data-popup-open:bg-white/8 data-popup-open:text-zinc-100 dark:bg-input/30 dark:hover:bg-input/50 dark:data-popup-open:bg-input/50'>
                  File
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className='grid w-56 gap-0.5 p-1'>
                    <li>
                      <NavigationMenuLink closeOnClick render={<button type='button' onClick={() => void handleNewDiagram()} />} className='gap-2 text-xs text-zinc-200'>
                        <FilePlus size={14} />
                        New
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink closeOnClick render={<button type='button' onClick={() => setTemplatesDialogOpen(true)} />} className='gap-2 text-xs text-zinc-200'>
                        <LayoutTemplate size={14} />
                        New from template
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink closeOnClick render={<Link href='/' />} className='gap-2 text-xs text-zinc-200'>
                        <FolderOpen size={14} />
                        Open
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink closeOnClick render={<button type='button' disabled={savingAs} onClick={() => void handleSaveAs()} />} className='gap-2 text-xs text-zinc-200 disabled:pointer-events-none disabled:opacity-50'>
                        {savingAs ? <LoaderCircle size={14} className='animate-spin' /> : <Copy size={14} />}
                        Save as
                      </NavigationMenuLink>
                    </li>
                    <li className='my-1 h-px bg-white/8' />
                    <li>
                      <NavigationMenuLink closeOnClick render={<button type='button' onClick={handleExportJson} />} className='gap-2 text-xs text-zinc-200'>
                        <FileJson size={14} />
                        Export to JSON
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink
                        closeOnClick
                        render={
                          <button
                            type='button'
                            onClick={() => {
                              setPlaygroundOpen(true);
                              selectNode(null);
                              selectEdge(null);
                            }}
                          />
                        }
                        className='gap-2 text-xs text-zinc-200'
                      >
                        <FlaskConical size={14} />
                        JSON Playground
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink
                        closeOnClick
                        render={<button type='button' disabled={!currentDiagramPublic} onClick={() => setShareOpen(true)} />}
                        className='gap-2 text-xs text-orange-300 disabled:pointer-events-none disabled:opacity-50'
                      >
                        <Share2 size={14} />
                        Share
                      </NavigationMenuLink>
                    </li>
                    <li className='my-1 h-px bg-white/8' />
                    <li>
                      <NavigationMenuLink closeOnClick render={<button type='button' onClick={() => setResetConfirmOpen(true)} />} className='gap-2 text-xs text-rose-300'>
                        <RotateCcw size={14} />
                        Reset
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
          <Button
            variant='outline'
            onClick={() => setDiagramPublic(!currentDiagramPublic)}
            aria-pressed={currentDiagramPublic}
            title={currentDiagramPublic ? 'Public — anyone signed in can view via /diagrams/{id}/view' : 'Private — only you and administrators can view'}
            className={['h-9 gap-1.5 border-white/10 bg-black/25 px-3 text-xs font-semibold text-zinc-300 hover:bg-white/8 dark:border-white/10 dark:bg-input/30 dark:hover:bg-input/50', currentDiagramPublic ? 'text-emerald-300' : ''].join(' ')}
          >
            {currentDiagramPublic ? <Globe size={13} className='text-emerald-300' /> : <LockKeyhole size={13} />}
            {currentDiagramPublic ? 'Public' : 'Private'}
          </Button>
          <Button
            variant='outline'
            disabled={savingDiagram}
            onClick={() => void handleSaveDiagram()}
            title='Save'
            className='h-9 border-white/10 bg-black/25 text-xs font-semibold text-zinc-300 hover:bg-white/8 dark:bg-input/30 dark:hover:bg-input/50'
          >
            {savingDiagram ? <LoaderCircle size={13} className='animate-spin' /> : <Save size={13} />}
            Save
            {dirty && <span className='size-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(180,83,9,.8)]' />}
          </Button>
        </div>

        <div className='flex items-center gap-2'>
          <ButtonGroup aria-label='Execution mode'>
            {(
              [
                { value: 'sequential', label: 'Sequential', Icon: ListOrdered },
                { value: 'concurrent', label: 'Concurrent', Icon: RadioTower },
                { value: 'manual', label: 'Manual', Icon: Hand },
              ] as const
            ).map((mode) => (
              <Button
                key={mode.value}
                variant='outline'
                onClick={() => {
                  applySettings({ runMode: mode.value });
                  replay();
                }}
                aria-pressed={runMode === mode.value}
                className={[
                  'h-9 gap-1.5 border-white/10 bg-black/25 px-3 text-xs font-semibold dark:bg-input/30 dark:hover:bg-input/50',
                  runMode === mode.value ? 'bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/15 dark:bg-cyan-400/15 dark:hover:bg-cyan-400/15' : 'text-zinc-500 hover:text-zinc-200',
                ].join(' ')}
              >
                <mode.Icon size={12} /> {mode.label}
              </Button>
            ))}
          </ButtonGroup>
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
          <button
            type='button'
            disabled={runMode !== 'sequential'}
            onClick={() => applySettings({ repeatEnabled: !repeatEnabled })}
            aria-pressed={repeatEnabled}
            title='Automatically replay after the sequential run completes'
            className={[
              'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ring-1 transition',
              repeatEnabled && runMode === 'sequential' ? 'bg-emerald-400/15 text-emerald-100 ring-emerald-400/40' : 'bg-black/25 text-zinc-500 ring-white/10 hover:bg-white/6 hover:text-zinc-200',
              runMode !== 'sequential' ? 'cursor-not-allowed opacity-40 hover:bg-black/25 hover:text-zinc-500' : '',
            ].join(' ')}
          >
            <Repeat2 size={13} className={repeatEnabled && runMode === 'sequential' ? 'text-emerald-300' : ''} />
            Repeat
          </button>
          <Button variant='outline' onClick={replay} className='h-9 border-white/10 bg-black/25 text-xs font-semibold text-zinc-300 hover:bg-white/8'>
            <Play size={14} />
            Replay
          </Button>
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
            <AlertDialogDescription>All unsaved changes on the current canvas will be lost and it will revert to the last loaded state. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              onClick={() => {
                resetToTemplate();
                setResetConfirmOpen(false);
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ShareDialog diagramId={diagramId} isPublic={currentDiagramPublic} open={shareOpen} onOpenChange={setShareOpen} />

      <Dialog open={templatesDialogOpen} onOpenChange={setTemplatesDialogOpen}>
        <DialogContent className='max-w-2xl border-white/10 bg-zinc-950/95 text-zinc-100 backdrop-blur-xl'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2 text-sm font-semibold'>
              <LayoutTemplate size={14} className='text-sky-300' />
              New from template
            </DialogTitle>
            <DialogDescription className='text-xs text-zinc-500'>Replaces the current canvas with a starting template.</DialogDescription>
          </DialogHeader>
          <div className='flex max-h-80 flex-col gap-1 overflow-y-auto'>
            {templateItems.map((template) => (
              <button
                key={template.id}
                type='button'
                onClick={() => {
                  template.onSelect();
                  setTemplatesDialogOpen(false);
                }}
                className='flex flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition hover:bg-white/6'
              >
                <span className='flex w-full items-center justify-between gap-2 text-xs font-semibold text-zinc-100'>
                  {template.name}
                  <span className='shrink-0 font-mono text-[9px] font-normal text-zinc-600'>{template.nodeCount} blocks</span>
                </span>
                <span className='block truncate text-[10px] font-normal text-zinc-500'>
                  {template.category} · {template.description}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <main className={['grid min-h-0 flex-1 gap-2 overflow-hidden', hasSidebar ? 'grid-cols-[1fr_320px]' : 'grid-cols-1'].join(' ')}>
        <section className='relative h-full min-h-0 overflow-hidden bg-zinc-950'>
          <FlowCanvas
            key={seed}
            document={doc}
            infoOpen={infoOpen}
            onToggleInfo={toggleInfo}
            activeNodeIds={active}
            runningEdgeIds={runningEdgeIds}
            nodeExecutionStates={nodeExecutionStates}
            edgeExecutionStates={edgeExecutionStates}
            selectedNodeId={selectedNodeId}
            onSelectNode={selectNode}
            onNodeMove={onNodeMove}
            onNodeResize={onNodeUpdate}
            onNodeDragStart={(id) => setDraggingNodeId(id)}
            onNodeDragEnd={() => setDraggingNodeId(null)}
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
              {/* Gentle slide-in each time the panel appears (the whole
                  aside mounts when something becomes selected). */}
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
                    sourceTitle={doc.nodes.find((node) => node.id === selectedEdge.from)?.title ?? selectedEdge.from}
                    targetTitle={doc.nodes.find((node) => node.id === selectedEdge.to)?.title ?? selectedEdge.to}
                    fallbackColor={doc.nodes.find((node) => node.id === selectedEdge.from) ? resolveNodeStyle(doc.nodes.find((node) => node.id === selectedEdge.from)!).foreground : '#67e8f9'}
                    onUpdate={onEdgeUpdate}
                    onDelete={(id) => {
                      onEdgeDelete(id);
                      selectEdge(null);
                    }}
                    onClose={() => selectEdge(null)}
                  />
                )}

                {infoOpen && (
                  <div className='rounded-xl bg-zinc-900/70 py-3 pr-3 pl-1'>
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

                {playgroundOpen && (
                  <div className='rounded-xl bg-zinc-900/70 p-3'>
                    <div className='flex items-center justify-between gap-2'>
                      <span className='flex items-center gap-1.5 text-xs font-semibold text-zinc-200'>
                        <FlaskConical size={13} className='text-cyan-300' />
                        JSON Playground
                      </span>
                      <button type='button' onClick={() => setPlaygroundOpen(false)} title='Close' className='rounded p-1 text-zinc-500 transition hover:bg-white/6 hover:text-zinc-200'>
                        <X size={13} />
                      </button>
                    </div>
                    <p className='mt-2 text-[11px] leading-relaxed text-zinc-500'>
                      Paste a FlowDocumentJSON below and render it on the canvas — see the{' '}
                      <Link href='/guide' target='_blank' className='text-cyan-300 underline underline-offset-2 hover:text-cyan-200'>
                        authoring guide
                      </Link>{' '}
                      for the schema. Rendering replaces the current canvas — Save to keep it, or Reset to revert.
                    </p>
                    <textarea
                      value={jsonDraft}
                      onChange={(event) => setJsonDraft(event.target.value)}
                      placeholder='{ "nodes": [...], "edges": [...] }'
                      spellCheck={false}
                      className='mt-3 h-56 w-full resize-y rounded-lg border border-white/10 bg-black/40 p-2 font-mono text-[11px] leading-relaxed text-zinc-200 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30'
                    />
                    {jsonError && <p className='mt-2 rounded-md bg-rose-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-rose-300 ring-1 ring-rose-400/30'>{jsonError}</p>}
                    <div className='mt-3 flex items-center gap-2'>
                      <Button onClick={handleRenderJson} disabled={!jsonDraft.trim()} className='h-8 flex-1 gap-1.5 bg-cyan-300 text-xs font-semibold text-zinc-950 hover:bg-cyan-200'>
                        <Play size={13} />
                        Render
                      </Button>
                      <Button
                        variant='outline'
                        onClick={() => {
                          setJsonDraft(JSON.stringify(doc, null, 2));
                          setJsonError(null);
                        }}
                        title='Fill with the current canvas document'
                        className='h-8 border-white/10 bg-black/25 text-xs text-zinc-300 hover:bg-white/8'
                      >
                        <FileJson size={13} />
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            </ScrollArea>
          </aside>
        )}
      </main>
    </div>
  );
}
