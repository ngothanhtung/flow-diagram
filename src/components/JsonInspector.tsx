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
    <div>
      <button type='button' onClick={() => setOpen((v) => !v)} className='flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground'>
        <span className='flex items-center gap-2'>
          <Braces size={14} />
          {caption}
        </span>
        {open ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
      {open && <pre className='max-h-72 overflow-auto border-t border-border px-4 py-3 font-mono text-[11px] leading-relaxed text-muted-foreground'>{value}</pre>}
    </div>
  );
}
