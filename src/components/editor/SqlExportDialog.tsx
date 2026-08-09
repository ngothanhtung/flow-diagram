'use client';

// Shows the CREATE TABLE script for the diagram's table nodes, with
// copy-to-clipboard and a .sql download. Opened from File → Export SQL.

import { Check, Copy, Database, Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildCreateTableSql } from '@/lib/sql-export';
import type { FlowDocumentJSON } from '@/lib/flowchart-types';

export function SqlExportDialog({ document, filename, open, onOpenChange }: { document: FlowDocumentJSON; filename: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [copied, setCopied] = useState(false);
  // Only recompute while the dialog is actually open.
  const result = useMemo(() => (open ? buildCreateTableSql(document) : null), [open, document]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setCopied(false);
    onOpenChange(next);
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.sql);
      setCopied(true);
      toast.success('SQL copied');
    } catch {
      toast.error('Could not copy the SQL');
    }
  };

  const download = () => {
    if (!result) return;
    const blob = new Blob([result.sql], { type: 'application/sql' });
    const url = URL.createObjectURL(blob);
    const anchor = globalThis.document.createElement('a');
    anchor.href = url;
    anchor.download = `${filename.replace(/[^a-z0-9-_]+/gi, '-')}.sql`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-w-3xl border-white/10 bg-zinc-950/95 text-zinc-100 backdrop-blur-xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-sm font-semibold'>
            <Database size={14} className='text-sky-300' />
            Export SQL
          </DialogTitle>
          <DialogDescription className='text-xs text-zinc-500'>
            {result ? `${result.tableCount} table(s), ${result.foreignKeyCount} foreign key(s). Data types are exactly what you typed, so this suits whichever database you had in mind.` : ''}
          </DialogDescription>
        </DialogHeader>
        <pre className='max-h-[55vh] overflow-auto rounded-lg bg-black/40 p-4 font-mono text-[11px] leading-relaxed text-zinc-200 ring-1 ring-white/8'>{result?.sql ?? ''}</pre>
        <div className='flex justify-end gap-2'>
          <Button variant='toolbar' onClick={download} disabled={!result?.tableCount}>
            <Download size={13} />
            Download .sql
          </Button>
          <Button variant='accent' onClick={() => void copy()} disabled={!result?.tableCount}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
