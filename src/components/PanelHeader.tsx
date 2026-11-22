import { X } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * The header strip of a docked side panel (Narration preview, Inspector, the
 * viewer's Info): small uppercase label, hairline under it. A fixed height,
 * so strips with and without a close button line up side by side.
 */
export function PanelHeader({ icon, label, onClose, closeLabel = 'Close' }: { icon: ReactNode; label: string; onClose?: () => void; closeLabel?: string }) {
  return (
    <div data-slot='panel-header' className='flex h-9 shrink-0 items-center gap-1.5 border-b border-border px-4 font-reading text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground'>
      {icon}
      {label}
      {onClose && (
        <button type='button' aria-label={closeLabel} title={closeLabel} onClick={onClose} className='ml-auto grid size-5 place-items-center rounded transition hover:bg-accent hover:text-foreground'>
          <X size={12} />
        </button>
      )}
    </div>
  );
}
