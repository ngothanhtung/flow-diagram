'use client';

import { FolderInput, FolderX, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { FolderIcon } from '@/components/lessons/FolderIcon';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FOLDER_NAME_MAX, LESSON_NOUN, childFolders, descendantFolderIds, folderNumber, lessonCountInSubtree, type LessonTree, type TreeNoun } from '@/lib/lesson/lesson-tree';

/** Name a new folder or rename one. `key` it per opening so the field starts from `initialName`. */
export function FolderNameDialog({
  open,
  title,
  description,
  initialName,
  confirmLabel,
  onSubmit,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  description: string;
  initialName: string;
  confirmLabel: string;
  onSubmit: (name: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(initialName);
  const submit = () => {
    onSubmit(name);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-sm border border-border bg-popover'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className='flex flex-col gap-4'
        >
          <Input autoFocus value={name} maxLength={FOLDER_NAME_MAX} placeholder='Folder name' aria-label='Folder name' onChange={(event) => setName(event.target.value)} />
          <DialogFooter>
            <Button type='button' variant='ghost' onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type='submit' variant='accent'>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Every folder, indented as in the tree, in display order. */
function flatFolders(tree: LessonTree): { id: string; depth: number; label: string; color: LessonTree['folders'][string]['color'] }[] {
  const out: { id: string; depth: number; label: string; color: LessonTree['folders'][string]['color'] }[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const folder of childFolders(tree, parentId)) {
      out.push({ id: folder.id, depth, label: `${folderNumber(tree, folder.id)} ${folder.name}`, color: folder.color });
      visit(folder.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
}

/**
 * Pick where something goes. For a folder, `excludeId` hides that folder and
 * its subfolders (it can't move into itself); `noneLabel` is the "no folder"
 * choice — "Top level" for a folder, "Unfiled" for a Lesson.
 */
export function MoveToFolderDialog({
  open,
  tree,
  title,
  description,
  noneLabel,
  currentId,
  excludeId,
  onPick,
  onOpenChange,
}: {
  open: boolean;
  tree: LessonTree;
  title: string;
  description: string;
  noneLabel: string;
  currentId: string | null;
  excludeId?: string;
  onPick: (folderId: string | null) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const hidden = excludeId ? descendantFolderIds(tree, excludeId).add(excludeId) : new Set<string>();
  const choices = flatFolders(tree).filter((folder) => !hidden.has(folder.id));
  const pick = (folderId: string | null) => {
    onPick(folderId);
    onOpenChange(false);
  };
  const row = 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-accent disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md border border-border bg-popover'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className='max-h-[60vh] overflow-auto rounded-lg ring-1 ring-border'>
          <div className='p-1'>
            <button type='button' className={row} disabled={currentId === null} onClick={() => pick(null)}>
              <FolderInput size={15} className='text-muted-foreground' />
              <span className='font-medium'>{noneLabel}</span>
              {currentId === null && <span className='ml-auto text-xs text-muted-foreground'>current</span>}
            </button>
            {choices.map((folder) => (
              <button key={folder.id} type='button' className={row} style={{ paddingLeft: `${0.5 + folder.depth * 1.1}rem` }} disabled={currentId === folder.id} onClick={() => pick(folder.id)}>
                <FolderIcon color={folder.color} size={13} />
                <span className='truncate'>{folder.label}</span>
                {currentId === folder.id && <span className='ml-auto text-xs text-muted-foreground'>current</span>}
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Delete a folder — or, when its subtree still holds Lessons, explain why
 * it can't be deleted and delete nothing.
 */
export function DeleteFolderDialog({ tree, folderId, noun = LESSON_NOUN, onConfirm, onOpenChange }: { tree: LessonTree; folderId: string | null; noun?: TreeNoun; onConfirm: (folderId: string) => void; onOpenChange: (open: boolean) => void }) {
  const folder = folderId !== null && Object.hasOwn(tree.folders, folderId) ? tree.folders[folderId] : null;
  const lessons = folderId !== null && folder ? lessonCountInSubtree(tree, folderId) : 0;
  const subfolders = folderId !== null && folder ? descendantFolderIds(tree, folderId).size : 0;
  return (
    <AlertDialog open={folder !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent className='border border-border bg-popover'>
        {lessons > 0 ? (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia className='bg-amber-400/10 text-amber-600 dark:text-amber-300'>
                <FolderX />
              </AlertDialogMedia>
              <AlertDialogTitle>This folder can’t be deleted</AlertDialogTitle>
              <AlertDialogDescription>
                “{folder?.name}” still holds {lessons} {lessons === 1 ? noun.one : noun.many}
                {subfolders > 0 ? ' (including its subfolders)' : ''}. Move or delete them first.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>OK</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia className='bg-rose-400/10 text-rose-600 dark:text-rose-300'>
                <Trash2 />
              </AlertDialogMedia>
              <AlertDialogTitle>Delete folder?</AlertDialogTitle>
              <AlertDialogDescription>
                “{folder?.name}”{subfolders > 0 ? ` and its ${subfolders} subfolder${subfolders === 1 ? '' : 's'}` : ''} will be deleted. No {noun.many} are affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant='destructive'
                onClick={() => {
                  if (folderId !== null) onConfirm(folderId);
                  onOpenChange(false);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
