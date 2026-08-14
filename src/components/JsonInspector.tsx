'use client';

import { Braces, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

interface JsonInspectorProps {
  /** Pretty-printed JSON to display. */
  value: string;
  /** Caption shown in the header. */
  caption?: string;
}

export function JsonInspector({ value, caption = 'FlowDocumentJSON' }: JsonInspectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className='rounded-xl bg-card backdrop-blur'>
      <button type='button' onClick={() => setOpen((v) => !v)} className='flex w-full items-center justify-between gap-2 py-2.5 pr-4 pl-1 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground'>
        <span className='flex items-center gap-2'>
          <Braces size={14} />
          {caption}
        </span>
        {open ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
      {open && <pre className='max-h-72 overflow-auto border-t border-border py-3 pr-3 pl-1 font-mono text-[11px] leading-relaxed text-muted-foreground'>{value}</pre>}
    </div>
  );
}
