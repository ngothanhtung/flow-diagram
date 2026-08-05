'use client';

import { Check, Copy, Globe, LockKeyhole, Share2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

/**
 * Read-only "share" popup — copies the `/diagrams/{id}/view` link.
 * Reused by both the diagrams list (per-row) and the editor toolbar
 * (current diagram), so it takes primitives rather than a row type.
 */
export function ShareDialog({ diagramId, isPublic, open, onOpenChange }: { diagramId: string; isPublic: boolean; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' && diagramId ? `${window.location.origin}/diagrams/${diagramId}/view` : '';

  const handleOpenChange = (next: boolean) => {
    if (!next) setCopied(false);
    onOpenChange(next);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='border-white/10 bg-zinc-950/95 text-zinc-100 backdrop-blur-xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-sm font-semibold'>
            <Share2 size={14} className='text-sky-300' />
            Share diagram
          </DialogTitle>
          <DialogDescription className='text-xs text-zinc-500'>Anyone with this link opens a read-only viewer — it does not grant edit access.</DialogDescription>
        </DialogHeader>
        <div className='flex items-center gap-2'>
          <Input readOnly value={url} onFocus={(event) => event.target.select()} className='border-white/10 bg-black/25 font-mono text-xs' />
          <Button onClick={() => void copy()} disabled={!url} className='shrink-0 bg-cyan-300 text-zinc-950 hover:bg-cyan-200'>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <p className={['flex items-center gap-1.5 text-[11px]', isPublic ? 'text-emerald-300' : 'text-amber-300'].join(' ')}>
          {isPublic ? <Globe size={12} /> : <LockKeyhole size={12} />}
          {isPublic ? 'This diagram is public — the link works for anyone signed in.' : 'This diagram is private — only you and administrators can open the link. Make it public first to share it.'}
        </p>
      </DialogContent>
    </Dialog>
  );
}
