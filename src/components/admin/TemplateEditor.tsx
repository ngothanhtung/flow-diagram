'use client';

import { motion } from 'framer-motion';
import { FileQuestion, LayoutTemplate, LoaderCircle, Save, ShieldOff } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AuthLoadingScreen, LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/components/auth/AuthProvider';
import { EdgeInspector } from '@/components/EdgeInspector';
import { FlowCanvas } from '@/components/FlowCanvas';
import { JsonInspector } from '@/components/JsonInspector';
import { NodeInspector } from '@/components/NodeInspector';
import { ShapeToolbar } from '@/components/ShapeToolbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEditorStore } from '@/lib/editor-store';
import { getTemplateById, saveTemplate } from '@/lib/firebase/templates';
import { isAdminUser } from '@/lib/firebase/roles';
import { resolveNodeStyle } from '@/lib/node-style';

/**
 * Admin-only editor for one template in the shared `templates`
 * collection. Reuses the global editor store for canvas editing — the
 * loaded template becomes the store document, and "Save template"
 * writes it back to Firestore together with name / category /
 * description. Regular users only ever read from this library.
 */
export function TemplateEditor({ templateId }: { templateId: string }) {
  const { user, loading } = useAuth();
  const [roleStatus, setRoleStatus] = useState<'checking' | 'denied' | 'admin'>('checking');
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [meta, setMeta] = useState({ name: '', category: '', description: '' });
  const [saving, setSaving] = useState(false);

  // The canvas itself lives in the shared editor store.
  const doc = useEditorStore((state) => state.doc);
  const seed = useEditorStore((state) => state.seed);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedEdgeId = useEditorStore((state) => state.selectedEdgeId);
  const draggingNodeId = useEditorStore((state) => state.draggingNodeId);
  const linkingFromId = useEditorStore((state) => state.linkingFromId);
  const activeShape = useEditorStore((state) => state.activeShape);
  const infoOpen = useEditorStore((state) => state.infoOpen);

  const { loadRemoteTemplate, selectNode, selectEdge, setDraggingNodeId, setLinkingFromId, setActiveShape, toggleInfo, onNodeMove, onNodeUpdate, onNodeDuplicate, onNodeDelete, onConnect, onShapeCreate, onEdgeDelete, onEdgeUpdate, onEdgeReconnect } =
    useEditorStore();

  // Gate on `users-roles/{uid}` first, then load the template into the
  // editor store so the canvas becomes fully interactive.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const allowed = await isAdminUser(user.uid);
      if (cancelled) return;
      if (!allowed) {
        setRoleStatus('denied');
        return;
      }
      setRoleStatus('admin');
      try {
        const template = await getTemplateById(templateId);
        if (cancelled) return;
        if (!template) {
          setStatus('not-found');
          return;
        }
        loadRemoteTemplate({
          name: template.name,
          category: template.category ?? '',
          description: template.description ?? '',
          document: template.document ?? { nodes: [], edges: [] },
        });
        setMeta({ name: template.name, category: template.category ?? '', description: template.description ?? '' });
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateId, user, loadRemoteTemplate]);

  const selectedNode = useMemo(() => doc.nodes.find((node) => node.id === selectedNodeId) ?? null, [doc.nodes, selectedNodeId]);
  const selectedEdge = useMemo(() => doc.edges.find((edge) => edge.id === selectedEdgeId) ?? null, [doc.edges, selectedEdgeId]);
  const hasSidebar = selectedNode !== null || selectedEdge !== null || infoOpen;

  const handleSave = async () => {
    const nextName = meta.name.trim();
    if (!nextName) {
      toast.error('Please name the template');
      return;
    }
    setSaving(true);
    try {
      await saveTemplate(templateId, nextName, meta.category.trim() || 'General', meta.description.trim(), doc);
      toast.success('Template saved', { description: nextName });
    } catch {
      toast.error('Could not save template', { description: 'Check sign-in and Firestore rules.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading || roleStatus === 'checking') return <AuthLoadingScreen />;
  if (!user) return <LoginForm />;

  if (roleStatus === 'denied') {
    return (
      <div className='grid h-screen place-items-center bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100'>
        <div className='flex max-w-sm flex-col items-center gap-4 rounded-xl bg-zinc-900/70 px-8 py-10 text-center'>
          <div className='grid size-12 place-items-center rounded-full bg-red-500/15 ring-1 ring-red-400/40'>
            <ShieldOff size={22} className='text-red-300' />
          </div>
          <div>
            <h1 className='text-sm font-semibold'>Không có quyền truy cập</h1>
            <p className='mt-1.5 text-xs leading-relaxed text-zinc-500'>Trang này chỉ dành cho người dùng có role `administrators` trong `users-roles`.</p>
          </div>
          <Button variant='outline' size='sm' onClick={() => (window.location.href = '/')} className='border-white/10 bg-black/25 text-zinc-300 hover:bg-white/8'>
            Back to editor
          </Button>
        </div>
      </div>
    );
  }

  if (status !== 'ready') {
    return (
      <div className='grid h-screen place-items-center bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100'>
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
    <div className='flex h-screen flex-col bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100'>
      <header className='flex items-center justify-between border-b border-white/5 px-6 py-4'>
        <div className='flex items-center gap-3'>
          <div className='grid h-9 w-9 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/40'>
            <LayoutTemplate size={18} className='text-sky-300' />
          </div>
          <div>
            <h1 className='text-base font-semibold'>Edit template</h1>
            <p className='font-mono text-[10px] text-zinc-500'>templates/{templateId}</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Link href='/admin/templates' className='inline-flex h-9 items-center gap-1.5 rounded-md bg-white/5 px-3 text-xs font-semibold text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10'>
            Back to templates
          </Link>
          <Button onClick={() => void handleSave()} disabled={saving} className='h-9 bg-cyan-300 text-zinc-950 hover:bg-cyan-200'>
            {saving ? <LoaderCircle size={14} className='animate-spin' /> : <Save size={14} />}
            Save template
          </Button>
        </div>
      </header>

      <div className='flex items-center gap-2 border-b border-white/5 px-6 py-2.5'>
        <Input value={meta.name} onChange={(event) => setMeta((current) => ({ ...current, name: event.target.value }))} placeholder='Template name' aria-label='Template name' className='max-w-64 border-white/10 bg-black/25' />
        <Input value={meta.category} onChange={(event) => setMeta((current) => ({ ...current, category: event.target.value }))} placeholder='Category' aria-label='Category' className='max-w-40 border-white/10 bg-black/25' />
        <Input value={meta.description} onChange={(event) => setMeta((current) => ({ ...current, description: event.target.value }))} placeholder='Description' aria-label='Description' className='border-white/10 bg-black/25' />
      </div>

      <main className={['grid min-h-0 flex-1 gap-2 overflow-hidden', hasSidebar ? 'grid-cols-[1fr_320px]' : 'grid-cols-1'].join(' ')}>
        <section className='relative h-full min-h-0 overflow-hidden bg-zinc-950'>
          <FlowCanvas
            key={seed}
            document={doc}
            infoOpen={infoOpen}
            onToggleInfo={toggleInfo}
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
