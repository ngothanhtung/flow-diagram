'use client';

import { Presentation } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PresentMode } from '@/components/present/PresentMode';
import type { FlowDocumentJSON } from '@/lib/flowchart-types';

/** Header button that opens Present mode on a Diagram (the editor's live document, or the viewer's). */
export function PresentButton({ document, name }: { document: FlowDocumentJSON; name: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const empty = document.nodes.length === 0;
  return (
    <>
      <Button variant='toolbar' size='lg' disabled={empty} onClick={() => setOpen(true)} title={empty ? 'Diagram is empty' : 'Present — full screen, step with → and ←, Esc to leave'} aria-label='Present'>
        <Presentation size={13} />
        <span className='hidden sm:inline'>Present</span>
      </Button>
      {open && <PresentMode document={document} name={name} onExit={close} />}
    </>
  );
}
