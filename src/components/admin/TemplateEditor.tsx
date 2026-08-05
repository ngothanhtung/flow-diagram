'use client';

import { motion } from 'framer-motion';
import { FileJson, FilePlus, FileQuestion, FolderOpen, Hand, LayoutTemplate, ListOrdered, LoaderCircle, Play, RadioTower, Repeat2, RotateCcw, Save, SkipForward } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EdgeInspector } from '@/components/EdgeInspector';
import { FlowCanvas } from '@/components/FlowCanvas';
import { Input } from '@/components/ui/input';
import { JsonInspector } from '@/components/JsonInspector';
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from '@/components/ui/navigation-menu';
import { NodeInspector } from '@/components/NodeInspector';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShapeToolbar } from '@/components/ShapeToolbar';
import { diagramTemplates } from '@/lib/diagram-templates';
import { EDGE_DRAW_DURATION_MS, NODE_FADE_DURATION_MS } from '@/lib/execution-timing';
import { computeOrderedGroups, useEditorStore } from '@/lib/editor-store';
import type { ExecutionState } from '@/lib/flowchart-types';
import { createTemplate, getTemplateById, listTemplates, saveTemplate, type StoredTemplate } from '@/lib/firebase/templates';
import { resolveNodeStyle } from '@/lib/node-style';

const NODE_PHASE_MS = NODE_FADE_DURATION_MS;
const LINE_PHASE_MS = EDGE_DRAW_DURATION_MS;
const REPEAT_PAUSE_MS = 800;

interface TemplateMeta {
  name: string;
  category: string;
  description: string;
}

/**
 * Admin-only editor for one template in the shared `templates`
 * collection. Mirrors `DiagramEditor` (same toolbar, run-mode preview,
 * File menu, canvas) — the loaded template becomes the store document,
 * and "Save" writes it back to Firestore together with name / category /
 * description instead of to a user's diagram.
 */
export function TemplateEditor({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [meta, setMeta] = useState<TemplateMeta>({ name: '', category: '', description: '' });
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // The canvas itself lives in the shared editor store.
  const doc = useEditorStore((state) => state.doc);
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

  // Load the template into the editor store so the canvas becomes fully
  // interactive. `AdminShell` already gates this route on the
  // `administrators` role.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const template = await getTemplateById(templateId);
        if (cancelled) return;
        if (!template) {
          setStatus('not-found');
          return;
        }
        const document = template.document ?? { nodes: [], edges: [] };
        loadRemoteTemplate({ name: template.name, category: template.category ?? '', description: template.description ?? '', document });
        const nextMeta = { name: template.name, category: template.category ?? '', description: template.description ?? '' };
        setMeta(nextMeta);
        setSavedSignature(JSON.stringify({ doc: document, meta: nextMeta }));
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateId, loadRemoteTemplate]);

  const selectedNode = useMemo(() => doc.nodes.find((node) => node.id === selectedNodeId) ?? null, [doc.nodes, selectedNodeId]);
  const selectedEdge = useMemo(() => doc.edges.find((edge) => edge.id === selectedEdgeId) ?? null, [doc.edges, selectedEdgeId]);
  const hasSidebar = selectedNode !== null || selectedEdge !== null || infoOpen;

  const runMode = doc.settings?.runMode ?? 'sequential';
  const repeatEnabled = doc.settings?.repeatEnabled ?? false;
  const documentSignature = useMemo(() => JSON.stringify({ doc, meta }), [doc, meta]);
  const dirty = savedSignature !== documentSignature;

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

  // The "New from template" picker starts a template from the shared
  // Firestore library, falling back to the built-in templates.
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
            onSelect: () => loadRemoteTemplate({ name: template.name, category: template.category ?? 'General', description: template.description ?? '', document: template.document ?? { nodes: [], edges: [] } }),
          }))
        : diagramTemplates.map((template) => ({
            id: template.id,
            name: template.name,
            category: template.category,
            description: template.description,
            nodeCount: template.document.nodes.length,
            onSelect: () => loadRemoteTemplate({ name: template.name, category: template.category, description: template.description, document: template.document }),
          })),
    [remoteTemplates, loadRemoteTemplate],
  );

  useEffect(() => {
    if (runMode !== 'sequential' || orderedGroups.length === 0) return;

    const reachedLastNode = runStep >= orderedGroups.length - 1 && runPhase === 'node';
    if (reachedLastNode && !repeatEnabled) return;

    const timer = window.setTimeout(advanceStep, reachedLastNode ? NODE_PHASE_MS + REPEAT_PAUSE_MS : runPhase === 'line' ? LINE_PHASE_MS : NODE_PHASE_MS);
    return () => window.clearTimeout(timer);
  }, [orderedGroups.length, repeatEnabled, runMode, runPhase, runStep, seed, advanceStep]);

  const handleSave = useCallback(async () => {
    const nextName = meta.name.trim();
    if (!nextName) {
      toast.error('Please name the template');
      return;
    }
    setSaving(true);
    try {
      await saveTemplate(templateId, nextName, meta.category.trim() || 'General', meta.description.trim(), doc);
      setSavedSignature(JSON.stringify({ doc, meta }));
      toast.success('Template saved', { description: nextName });
    } catch {
      toast.error('Could not save template', { description: 'Check sign-in and Firestore rules.' });
    } finally {
      setSaving(false);
    }
  }, [templateId, meta, doc]);

  const handleNewTemplate = useCallback(async () => {
    setCreating(true);
    try {
      const id = await createTemplate('Untitled template', 'General', '', { nodes: [], edges: [] });
      router.push(`/admin/templates/${id}/edit`);
    } catch {
      toast.error('Could not create template', { description: 'Check sign-in and Firestore rules.' });
      setCreating(false);
    }
  }, [router]);

  const handleExportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(meta.name.trim() || 'template').replace(/[^a-z0-9-_]+/gi, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [doc, meta.name]);

  if (status !== 'ready') {
    return (
      <div className='grid h-full place-items-center bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100'>
        <div className='flex max-w-sm flex-col items-center gap-4 rounded-xl bg-zinc-900/70 px-8 py-10 text-center'>
          <div className='grid size-12 place-items-center rounded-full bg-sky-500/15 ring-1 ring-sky-400/40'>
            {status === 'loading' ? <LoaderCircle size={22} className='animate-spin text-sky-300' /> : <FileQuestion size={22} className='text-sky-300' />}
          </div>
          <div>
            <h1 className='text-sm font-semibold'>{status === 'loading' ? 'Loading template…' : status === 'not-found' ? 'Template not found' : 'Could not load template'}</h1>
            <p className='mt-1.5 text-xs leading-relaxed text-zinc-500'>{status === 'loading' ? `Looking up ${templateId} in the shared library.` : status === 'not-found' ? 'No template matches this id.' : 'Check your connection and try again.'}</p>
          </div>
          <Link href='/admin/templates' className='inline-flex h-8 items-center gap-1.5 rounded-md bg-white/5 px-3 text-xs font-semibold text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10'>
            Back to templates
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-full flex-col bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100'>
      <header className='flex items-center justify-between border-b border-white/5 px-6 py-4'>
        <div className='flex items-center gap-3'>
          <div className='grid h-9 w-9 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/40'>
            <LayoutTemplate size={18} className='text-sky-300' />
          </div>
          <div>
            <h1 className='text-base font-semibold'>X Flow Tool</h1>
            <p className='text-xs text-zinc-400'>{meta.name || 'Untitled template'}</p>
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
                      <NavigationMenuLink closeOnClick render={<button type='button' disabled={creating} onClick={() => void handleNewTemplate()} />} className='gap-2 text-xs text-zinc-200 disabled:pointer-events-none disabled:opacity-50'>
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
                      <NavigationMenuLink closeOnClick render={<Link href='/admin/templates' />} className='gap-2 text-xs text-zinc-200'>
                        <FolderOpen size={14} />
                        Open
                      </NavigationMenuLink>
                    </li>
                    <li className='my-1 h-px bg-white/8' />
                    <li>
                      <NavigationMenuLink closeOnClick render={<button type='button' onClick={handleExportJson} />} className='gap-2 text-xs text-zinc-200'>
                        <FileJson size={14} />
                        Export to JSON
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
            disabled={saving}
            onClick={() => void handleSave()}
            title='Save'
            className='h-9 border-white/10 bg-black/25 text-xs font-semibold text-zinc-300 hover:bg-white/8 dark:bg-input/30 dark:hover:bg-input/50'
          >
            {saving ? <LoaderCircle size={13} className='animate-spin' /> : <Save size={13} />}
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
        </div>
      </header>

      <div className='flex items-center gap-2 border-b border-white/5 px-6 py-2.5'>
        <Input value={meta.name} onChange={(event) => setMeta((current) => ({ ...current, name: event.target.value }))} placeholder='Template name' aria-label='Template name' className='max-w-64 border-white/10 bg-black/25' />
        <Input value={meta.category} onChange={(event) => setMeta((current) => ({ ...current, category: event.target.value }))} placeholder='Category' aria-label='Category' className='max-w-40 border-white/10 bg-black/25' />
        <Input value={meta.description} onChange={(event) => setMeta((current) => ({ ...current, description: event.target.value }))} placeholder='Description' aria-label='Description' className='border-white/10 bg-black/25' />
      </div>

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
              setActiveShape(null);
            }}
          />
          <ShapeToolbar activeShape={activeShape} onSelect={setActiveShape} />
        </section>

        {hasSidebar && (
          <aside className='h-full min-h-0 overflow-hidden' aria-label='Template inspector'>
            <ScrollArea className='h-full pr-1 [&_[data-slot=scroll-area-scrollbar]]:w-2 [&_[data-slot=scroll-area-thumb]]:bg-cyan-300/25'>
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
                        <p className='text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-400'>{meta.category || 'Template'}</p>
                        <h2 className='mt-1 text-sm font-semibold'>{meta.name || '(untitled)'}</h2>
                      </div>
                      <div className='shrink-0 rounded-lg bg-white/5 px-2 py-1 text-right ring-1 ring-white/10'>
                        <div className='text-xs font-semibold text-zinc-200'>
                          {doc.nodes.length} / {doc.edges.length}
                        </div>
                        <div className='text-[8px] uppercase tracking-wider text-zinc-500'>blocks / lines</div>
                      </div>
                    </div>
                    <p className='mt-2 text-[11px] leading-relaxed text-zinc-400'>{meta.description || 'No description yet.'}</p>
                    <p className='mt-3 text-[11px] leading-relaxed text-zinc-500'>You are editing the shared template. Save to publish the changes to every user.</p>
                  </div>
                )}

                {infoOpen && <JsonInspector value={JSON.stringify(doc, null, 2)} />}
              </motion.div>
            </ScrollArea>
          </aside>
        )}
      </main>
    </div>
  );
}
