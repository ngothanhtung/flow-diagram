'use client';

import { CopyPlus, Download, GitMerge, LoaderCircle, ShieldOff, Upload } from 'lucide-react';
import { useState } from 'react';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/components/data-table';
import { savedByLabel, type VersionActor } from '@/lib/version-history';

/** What stopped a Save, as the Editor shows it. */
export type BlockedSave =
  /** Someone saved since this editor loaded (or last saved) the Diagram. */
  | { kind: 'conflict'; revision: number; lastSavedBy: VersionActor | null; lastSavedAt: number | null }
  /** The Owner removed this Collaborator, or lowered them to Can view. */
  | { kind: 'revoked' }
  /** The Owner deleted the Diagram. */
  | { kind: 'missing' };

type Choice = 'overwrite' | 'save-as' | 'load-latest';

/**
 * Save conflict and lost-access dialog (PRD v0.3 §4.2).
 *
 * Conflict — says who saved and when, and offers the three ways out:
 * Overwrite (mine becomes the main copy; theirs stays in History as the
 * Version their Save wrote), Save as new Diagram (a copy of mine, owned by
 * me), Load latest (theirs replaces my canvas as one undo step).
 *
 * Revoked / missing — the only way to keep the edits is a copy of one's own.
 *
 * Actions don't auto-close (Base UI's AlertDialogAction with a custom
 * onClick), so each closes the dialog itself once its work is done.
 */
export function SaveConflictDialog({
  blocked,
  currentUid,
  onClose,
  onOverwrite,
  onSaveAsNew,
  onLoadLatest,
}: {
  blocked: BlockedSave | null;
  currentUid: string;
  onClose: () => void;
  onOverwrite: (revision: number) => Promise<void>;
  onSaveAsNew: () => Promise<void>;
  onLoadLatest: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<Choice | null>(null);

  const run = async (choice: Choice, action: () => Promise<void>) => {
    setBusy(choice);
    try {
      onClose();
      await action();
    } finally {
      setBusy(null);
    }
  };

  const conflict = blocked?.kind === 'conflict' ? blocked : null;
  const who = conflict ? savedByLabel(conflict.lastSavedBy, currentUid) : '';
  const when = conflict?.lastSavedAt ? formatDateTime(conflict.lastSavedAt) : null;

  return (
    <AlertDialog open={blocked !== null} onOpenChange={(open) => !open && busy === null && onClose()}>
      <AlertDialogContent className='border border-border bg-popover sm:max-w-md' data-testid='save-blocked-dialog'>
        {conflict ? (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia className='bg-amber-400/12 text-amber-700 dark:text-amber-300'>
                <GitMerge />
              </AlertDialogMedia>
              <AlertDialogTitle>Save conflict</AlertDialogTitle>
              <AlertDialogDescription>
                <span className='font-semibold text-foreground'>{who === 'You' ? 'You (in another tab or device)' : who}</span> saved this Diagram{when ? <> at <span className='font-semibold text-foreground'>{when}</span></> : null}, after you opened it. Saving now would replace their changes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className='grid gap-2'>
              <ChoiceButton icon={<Upload />} title='Overwrite' detail='Your version becomes the main copy. Theirs stays in History.' busy={busy === 'overwrite'} disabled={busy !== null} onClick={() => void run('overwrite', () => onOverwrite(conflict.revision))} />
              <ChoiceButton icon={<CopyPlus />} title='Save as new Diagram' detail='Keep the original as they saved it; your version becomes your own copy.' busy={busy === 'save-as'} disabled={busy !== null} onClick={() => void run('save-as', onSaveAsNew)} />
              <ChoiceButton icon={<Download />} title='Load latest' detail='Discard your changes and load theirs. Undo brings yours back.' busy={busy === 'load-latest'} disabled={busy !== null} onClick={() => void run('load-latest', onLoadLatest)} />
            </div>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia className='bg-rose-400/10 text-rose-600 dark:text-rose-300'>
                <ShieldOff />
              </AlertDialogMedia>
              <AlertDialogTitle>{blocked?.kind === 'missing' ? 'This Diagram was deleted' : 'You no longer have permission to edit this Diagram'}</AlertDialogTitle>
              <AlertDialogDescription>
                {blocked?.kind === 'missing' ? 'Its Owner deleted it, so it can’t be saved.' : 'Its Owner removed you or changed your access.'} Your changes are still on the canvas — save them as a new Diagram of your own to keep them.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className='grid gap-2'>
              <ChoiceButton icon={<CopyPlus />} title='Save as new Diagram' detail='A copy of what is on your canvas, owned by you.' busy={busy === 'save-as'} disabled={busy !== null} onClick={() => void run('save-as', onSaveAsNew)} />
            </div>
          </>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy !== null}>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ChoiceButton({ icon, title, detail, busy, disabled, onClick }: { icon: React.ReactNode; title: string; detail: string; busy: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <Button variant='outline' disabled={disabled} onClick={onClick} className='h-auto w-full items-start justify-start gap-3 border-border px-3 py-2.5 text-left whitespace-normal'>
      <span className='mt-0.5 text-muted-foreground [&_svg]:size-4'>{busy ? <LoaderCircle className='animate-spin' /> : icon}</span>
      <span className='min-w-0'>
        <span className='block text-xs font-semibold text-foreground'>{title}</span>
        <span className='block text-[11px] leading-snug font-normal text-muted-foreground'>{detail}</span>
      </span>
    </Button>
  );
}
