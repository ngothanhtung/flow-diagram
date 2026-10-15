'use client';

import { Fragment } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SHORTCUT_GROUPS, formatKeys } from '@/lib/shortcuts';
import { useIsMac } from '@/lib/use-is-mac';

/**
 * The keyboard cheat sheet, opened with `?` in either editor. Rows come
 * from `SHORTCUT_GROUPS`, the same list the key handler is written
 * against, and print ⌘ or Ctrl for the platform it is running on.
 */
export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const isMac = useIsMac();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[92vw] max-w-lg gap-0 border-border bg-popover p-0 sm:max-w-lg'>
        <DialogHeader className='px-6 pt-5 pb-3'>
          <DialogTitle className='text-base font-semibold text-foreground'>Keyboard shortcuts</DialogTitle>
          <DialogDescription className='text-[11px] leading-relaxed'>They act on the canvas. While you type in a field, keys keep their usual meaning there.</DialogDescription>
        </DialogHeader>
        <div className='flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-6 pb-6'>
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className='mb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-200'>{group.title}</h3>
              <dl className='divide-y divide-border rounded-lg ring-1 ring-border'>
                {group.rows
                  .filter((row) => !row.only || row.only === (isMac ? 'mac' : 'other'))
                  .map((row) => (
                    <div key={`${row.label}-${row.only ?? ''}`} className='flex items-center justify-between gap-3 px-3 py-2'>
                      <dt className='text-xs text-foreground'>{row.label}</dt>
                      <dd className='flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground'>
                        {row.combos.map((combo, index) => (
                          <Fragment key={combo.join('-')}>
                            {index > 0 && <span>or</span>}
                            <kbd className='rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground'>{formatKeys(combo, isMac)}</kbd>
                          </Fragment>
                        ))}
                      </dd>
                    </div>
                  ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
