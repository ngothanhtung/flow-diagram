'use client';

import { Cloud, FolderOpen, LoaderCircle, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { deleteDiagram, listDiagrams, loadDiagram, type StoredDiagram } from '@/lib/firebase/diagrams';

interface DiagramManagerProps {
  userId: string;
  currentDiagramId: string | null;
  onLoaded: (diagram: StoredDiagram) => void;
  onDeleted: (diagramId: string) => void;
}

function dateLabel(diagram: StoredDiagram) {
  const value = diagram.updatedAt ?? diagram.createdAt;
  return value ? value.toDate().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : 'Just updated';
}

export function DiagramManager({ userId, currentDiagramId, onLoaded, onDeleted }: DiagramManagerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [diagrams, setDiagrams] = useState<StoredDiagram[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoredDiagram | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setDiagrams(await listDiagrams(userId));
    } catch {
      toast.error('Could not load diagram library', {
        description: 'Check your Firestore rules and network connection.',
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) void refresh();
  };

  const visibleDiagrams = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    if (!keyword) return diagrams;
    return diagrams.filter((diagram) => diagram.name.toLocaleLowerCase().includes(keyword));
  }, [diagrams, search]);

  const loadSelected = async (diagram: StoredDiagram) => {
    setBusy(diagram.id);
    try {
      const latest = await loadDiagram(userId, diagram.id);
      if (!latest) throw new Error('Diagram no longer exists.');
      onLoaded(latest);
      setOpen(false);
      toast.success('Diagram loaded', { description: latest.name });
    } catch {
      toast.error('Could not load diagram');
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setBusy(target.id);
    try {
      await deleteDiagram(userId, target.id);
      setDiagrams((items) => items.filter((item) => item.id !== target.id));
      onDeleted(target.id);
      setDeleteTarget(null);
      toast.success('Diagram deleted', { description: target.name });
    } catch {
      toast.error('Could not delete diagram');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger render={<Button variant='outline' className='h-9 border-white/10 bg-black/25 text-zinc-300 hover:bg-white/8' />}>
          <FolderOpen className='text-cyan-300' />
          Diagrams
        </DialogTrigger>
        <DialogContent className='max-h-[88vh] gap-0 overflow-hidden border border-white/8 bg-zinc-950/96 p-0 sm:max-w-xl'>
          <DialogHeader className='border-b border-white/7 px-6 py-5'>
            <div className='flex items-center gap-3'>
              <span className='grid size-10 place-items-center rounded-xl bg-cyan-300/10 ring-1 ring-cyan-200/20'>
                <Cloud className='size-4 text-cyan-300' />
              </span>
              <div>
                <DialogTitle className='font-mono text-lg'>Diagram Library</DialogTitle>
                <DialogDescription className='mt-1 text-xs'>Saved diagrams from your private Firestore collection.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <section className='flex min-h-0 flex-col p-5'>
            <div className='flex items-center gap-2'>
              <div className='relative flex-1'>
                <Search className='pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-zinc-600' />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder='Search diagrams...' className='h-9 border-white/8 bg-white/[.025] pl-9' />
              </div>
              <Button variant='outline' size='icon-lg' onClick={refresh} disabled={loading} className='border-white/8 bg-transparent'>
                <RefreshCw className={loading ? 'animate-spin' : ''} />
                <span className='sr-only'>Refresh</span>
              </Button>
            </div>

            <ScrollArea className='mt-4 h-[360px] pr-3'>
              {loading && diagrams.length === 0 ? (
                <div className='grid h-40 place-items-center'>
                  <LoaderCircle className='size-5 animate-spin text-cyan-300' />
                </div>
              ) : visibleDiagrams.length === 0 ? (
                <div className='grid h-52 place-items-center rounded-xl border border-dashed border-white/10 text-center'>
                  <div>
                    <FolderOpen className='mx-auto size-6 text-zinc-700' />
                    <p className='mt-3 text-xs text-zinc-400'>No diagrams yet</p>
                    <p className='mt-1 text-[10px] text-zinc-600'>Save the current canvas to get started.</p>
                  </div>
                </div>
              ) : (
                <div className='space-y-2'>
                  {visibleDiagrams.map((diagram) => {
                    const selected = diagram.id === currentDiagramId;
                    return (
                      <article key={diagram.id} className={['group rounded-xl border p-3 transition', selected ? 'border-cyan-300/25 bg-cyan-300/[.055]' : 'border-white/7 bg-white/[.02] hover:border-white/14 hover:bg-white/[.04]'].join(' ')}>
                        <div className='flex items-start justify-between gap-3'>
                          <button type='button' onClick={() => loadSelected(diagram)} disabled={busy !== null} className='min-w-0 flex-1 text-left'>
                            <span className='block truncate text-xs font-semibold text-zinc-200'>{diagram.name}</span>
                            <span className='mt-1 block font-mono text-[9px] text-zinc-600'>
                              {dateLabel(diagram)} · {diagram.document.nodes.length} blocks
                            </span>
                          </button>
                          <div className='flex shrink-0 gap-1'>
                            <Button variant='ghost' size='icon-sm' onClick={() => loadSelected(diagram)} disabled={busy !== null}>
                              {busy === diagram.id ? <LoaderCircle className='animate-spin' /> : <FolderOpen />}
                              <span className='sr-only'>Load</span>
                            </Button>
                            <Button variant='ghost' size='icon-sm' onClick={() => setDeleteTarget(diagram)} className='text-zinc-600 hover:text-rose-300'>
                              <Trash2 />
                              <span className='sr-only'>Delete</span>
                            </Button>
                          </div>
                        </div>
                        {selected && (
                          <Badge variant='outline' className='mt-2 border-cyan-300/20 text-[8px] text-cyan-300'>
                            Open
                          </Badge>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </section>
          <DialogFooter className='border-t border-white/7 bg-black/20 px-5 py-3 text-[9px] text-zinc-600 sm:justify-between'>
            <span>users/{userId}/diagrams</span>
            <span>Firestore · owner-only rules</span>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className='border border-white/8 bg-zinc-950'>
          <AlertDialogHeader>
            <AlertDialogMedia className='bg-rose-400/10 text-rose-300'>
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete diagram?</AlertDialogTitle>
            <AlertDialogDescription>&ldquo;{deleteTarget?.name}&rdquo; will be deleted from Firestore and cannot be recovered.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={confirmDelete} disabled={busy !== null}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
