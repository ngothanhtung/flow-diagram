'use client';

import { LayoutTemplate } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EditorFileMenu, EditorStatusScreen, ResetCanvasDialog, SaveButton, downloadDocumentJson } from '@/components/editor/EditorChrome';
import { SqlExportDialog } from '@/components/editor/SqlExportDialog';
import { EditorShell } from '@/components/editor/EditorShell';
import { TemplatePickerDialog, useTemplateLibrary } from '@/components/editor/TemplatePickerDialog';
import { Input } from '@/components/ui/input';
import { useEditorStore } from '@/lib/editor-store';
import { createTemplate, getTemplateById, saveTemplate } from '@/lib/firebase/templates';

interface TemplateMeta {
  name: string;
  category: string;
  description: string;
}

/**
 * Admin-only editor for one template in the shared `templates`
 * collection. Everything visual comes from `components/editor/*` — the
 * same components the diagram editor mounts. Only the persistence target
 * (Firestore `templates`) and the name / category / description bar are
 * template-specific.
 */
export function TemplateEditor({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [meta, setMeta] = useState<TemplateMeta>({ name: '', category: '', description: '' });
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [sqlOpen, setSqlOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // The canvas itself lives in the shared editor store.
  const doc = useEditorStore((state) => state.doc);
  const loadRemoteTemplate = useEditorStore((state) => state.loadRemoteTemplate);
  const templateItems = useTemplateLibrary();

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

  // Name / category / description are saved with the document, so they
  // count towards the unsaved-changes dot too.
  const documentSignature = useMemo(() => JSON.stringify({ doc, meta }), [doc, meta]);
  const dirty = savedSignature !== documentSignature;

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

  if (status !== 'ready') {
    return (
      <EditorStatusScreen
        loading={status === 'loading'}
        title={status === 'loading' ? 'Loading template…' : status === 'not-found' ? 'Template not found' : 'Could not load template'}
        description={status === 'loading' ? `Looking up ${templateId} in the shared library.` : status === 'not-found' ? 'No template matches this id.' : 'Check your connection and try again.'}
        backHref='/admin/templates'
        backLabel='Back to templates'
      />
    );
  }

  return (
    <EditorShell
      document={doc}
      icon={<LayoutTemplate size={18} className='text-sky-300' />}
      subtitle={<p className='text-xs text-zinc-400'>{meta.name || 'Untitled template'}</p>}
      fileMenu={
        <EditorFileMenu
          onNew={() => void handleNewTemplate()}
          newDisabled={creating}
          onNewFromTemplate={() => setTemplatesDialogOpen(true)}
          openHref='/admin/templates'
          onExport={() => downloadDocumentJson(doc, meta.name.trim() || 'template')}
          onExportSql={() => setSqlOpen(true)}
          onReset={() => setResetConfirmOpen(true)}
        />
      }
      actions={<SaveButton saving={saving} dirty={dirty} onSave={() => void handleSave()} />}
      subBar={
        <div className='flex items-center gap-2 border-b border-white/5 px-6 py-2.5'>
          <Input value={meta.name} onChange={(event) => setMeta((current) => ({ ...current, name: event.target.value }))} placeholder='Template name' aria-label='Template name' variant='toolbar' className='max-w-64' />
          <Input value={meta.category} onChange={(event) => setMeta((current) => ({ ...current, category: event.target.value }))} placeholder='Category' aria-label='Category' variant='toolbar' className='max-w-40' />
          <Input value={meta.description} onChange={(event) => setMeta((current) => ({ ...current, description: event.target.value }))} placeholder='Description' aria-label='Description' variant='toolbar' />
        </div>
      }
      info={{
        category: meta.category || 'Template',
        title: meta.name || '(untitled)',
        description: meta.description || 'No description yet.',
        note: 'You are editing the shared template. Save to publish the changes to every user.',
      }}
      inspectorLabel='Template inspector'
    >
      <ResetCanvasDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen} />
      <TemplatePickerDialog open={templatesDialogOpen} onOpenChange={setTemplatesDialogOpen} items={templateItems} />
      <SqlExportDialog document={doc} filename={meta.name.trim() || 'template'} open={sqlOpen} onOpenChange={setSqlOpen} />
    </EditorShell>
  );
}
