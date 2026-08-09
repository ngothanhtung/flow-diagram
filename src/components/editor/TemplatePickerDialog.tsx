'use client';

import { LayoutTemplate } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEditorStore } from '@/lib/editor-store';
import { listTemplates, type StoredTemplate } from '@/lib/firebase/templates';

interface TemplateItem {
  id: string;
  name: string;
  category: string;
  description: string;
  nodeCount: number;
  onSelect: () => void;
}

/**
 * The shared template library backed by Firestore's `templates` collection.
 */
export function useTemplateLibrary(): TemplateItem[] {
  const userId = useAuth().user?.uid;
  const loadRemoteTemplate = useEditorStore((state) => state.loadRemoteTemplate);
  const [remoteTemplates, setRemoteTemplates] = useState<StoredTemplate[]>([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    listTemplates()
      .then((templates) => {
        if (!cancelled) setRemoteTemplates(templates);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return useMemo(
    () =>
      remoteTemplates.map((template) => ({
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
      })),
    [remoteTemplates, loadRemoteTemplate],
  );
}

export function TemplatePickerDialog({ open, onOpenChange, items }: { open: boolean; onOpenChange: (open: boolean) => void; items: TemplateItem[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl border-white/10 bg-zinc-950/95 text-zinc-100 backdrop-blur-xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-sm font-semibold'>
            <LayoutTemplate size={14} className='text-sky-300' />
            New from template
          </DialogTitle>
          <DialogDescription className='text-xs text-zinc-500'>Replaces the current canvas with a starting template.</DialogDescription>
        </DialogHeader>
        <div className='flex max-h-80 flex-col gap-1 overflow-y-auto'>
          {items.length === 0 && <p className='px-3 py-6 text-center text-xs text-zinc-500'>No templates are available in Firestore.</p>}
          {items.map((template) => (
            <button
              key={template.id}
              type='button'
              onClick={() => {
                template.onSelect();
                onOpenChange(false);
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
  );
}
