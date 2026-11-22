'use client';

import { ArrowDown, ArrowUp, ChevronRight, FolderInput, FolderPlus, Inbox, Library, MoreHorizontal, Palette, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { FolderIcon } from '@/components/lessons/FolderIcon';
import { DeleteFolderDialog, FolderNameDialog, MoveToFolderDialog } from '@/components/lessons/lesson-tree-dialogs';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FOLDER_COLORS,
  LESSON_NOUN,
  addFolder,
  childFolders,
  deleteFolder,
  folderLessons,
  folderNumber,
  lessonCountInSubtree,
  moveFolder,
  recolorFolder,
  renameFolder,
  reorderFolder,
  type LessonTree,
  type TreeEdit,
  type TreeNoun,
} from '@/lib/lesson/lesson-tree';

export type TreeSelection = { kind: 'all' } | { kind: 'unfiled' } | { kind: 'folder'; id: string };

type Naming = { mode: 'new'; parentId: string | null } | { mode: 'rename'; folderId: string } | null;

const rowClass = (active: boolean) =>
  `group/row flex w-full min-w-0 items-center gap-1.5 rounded-md py-1 pr-1 text-sm transition ${active ? 'bg-sky-500/15 text-foreground ring-1 ring-sky-400/40' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'}`;

/**
 * The left column of `/lessons` (and of `/`, for Diagrams): All, the folder tree and Unfiled.
 * Every change goes through `onEdit` (a pure edit applied to the stored
 * tree in a transaction); a refused edit comes back with its reason.
 */
export function LessonTreePanel({
  tree,
  totalCount,
  selection,
  openIds,
  onSelect,
  onToggle,
  onEdit,
  noun = LESSON_NOUN,
}: {
  tree: LessonTree;
  totalCount: number;
  selection: TreeSelection;
  openIds: ReadonlySet<string>;
  onSelect: (selection: TreeSelection) => void;
  onToggle: (folderId: string, open?: boolean) => void;
  onEdit: (edit: (tree: LessonTree) => TreeEdit) => Promise<boolean>;
  /** What the leaves are called: Lessons (default) or Diagrams. */
  noun?: TreeNoun;
}) {
  const [naming, setNaming] = useState<Naming>(null);
  const [namingKey, setNamingKey] = useState(0);
  const [moving, setMoving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const startNaming = (next: Naming) => {
    setNamingKey((key) => key + 1);
    setNaming(next);
  };

  const submitName = async (name: string) => {
    if (!naming) return;
    if (naming.mode === 'rename') {
      await onEdit((current) => renameFolder(current, naming.folderId, name));
      return;
    }
    const parentId = naming.parentId;
    let createdId: string | null = null;
    const created = await onEdit((current) => {
      const result = addFolder(current, { parentId, name });
      if (result.ok) createdId = Object.keys(result.tree.folders).find((id) => !Object.hasOwn(current.folders, id)) ?? null;
      return result;
    });
    if (created && createdId) {
      if (parentId) onToggle(parentId, true);
      onSelect({ kind: 'folder', id: createdId });
    }
  };

  const unfiledCount = folderLessons(tree, null).length;
  const isSelected = (id: string) => selection.kind === 'folder' && selection.id === id;

  const renderFolder = (folder: ReturnType<typeof childFolders>[number], depth: number) => {
    const children = childFolders(tree, folder.id);
    const open = openIds.has(folder.id);
    const count = lessonCountInSubtree(tree, folder.id);
    const siblings = childFolders(tree, folder.parentId);
    const index = siblings.findIndex((sibling) => sibling.id === folder.id);
    return (
      <li key={folder.id}>
        <div className={rowClass(isSelected(folder.id))} style={{ paddingLeft: `${0.25 + depth * 0.9}rem` }}>
          <button
            type='button'
            aria-label={open ? `Collapse ${folder.name}` : `Expand ${folder.name}`}
            aria-expanded={open}
            onClick={() => onToggle(folder.id)}
            className={`grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:text-foreground ${children.length === 0 ? 'invisible' : ''}`}
          >
            <ChevronRight size={14} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>
          <button type='button' className='flex min-w-0 flex-1 items-center gap-2 text-left' onClick={() => onSelect({ kind: 'folder', id: folder.id })} title={`${folderNumber(tree, folder.id)} ${folder.name}`}>
            <FolderIcon color={folder.color} size={14} className='shrink-0' />
            <span className='truncate'>
              <span className='tabular-nums text-muted-foreground'>{folderNumber(tree, folder.id)}</span> {folder.name}
            </span>
          </button>
          <span className='shrink-0 text-[11px] tabular-nums text-muted-foreground'>{count}</span>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant='ghost' size='icon-xs' aria-label={`Folder actions: ${folder.name}`} className='shrink-0 opacity-60 group-hover/row:opacity-100' />}>
              <MoreHorizontal size={14} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-52 border-border bg-popover'>
              <DropdownMenuItem onClick={() => startNaming({ mode: 'new', parentId: folder.id })}>
                <FolderPlus /> New subfolder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startNaming({ mode: 'rename', folderId: folder.id })}>
                <Pencil /> Rename
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Palette /> Color
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className='border-border bg-popover'>
                  {FOLDER_COLORS.map((color) => (
                    <DropdownMenuItem key={color} onClick={() => void onEdit((current) => recolorFolder(current, folder.id, color))}>
                      <FolderIcon color={color} size={12} />
                      <span className='capitalize'>{color}</span>
                      {folder.color === color && <span className='ml-auto text-xs text-muted-foreground'>current</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={index <= 0} onClick={() => void onEdit((current) => reorderFolder(current, folder.id, -1))}>
                <ArrowUp /> Move up
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index >= siblings.length - 1} onClick={() => void onEdit((current) => reorderFolder(current, folder.id, 1))}>
                <ArrowDown /> Move down
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setMoving(folder.id)}>
                <FolderInput /> Move to…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant='destructive' onClick={() => setDeleting(folder.id)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {open && children.length > 0 && <ul>{children.map((child) => renderFolder(child, depth + 1))}</ul>}
      </li>
    );
  };

  const movingFolder = moving !== null && Object.hasOwn(tree.folders, moving) ? tree.folders[moving] : null;

  return (
    <nav aria-label={`${noun.title} folders`} className='flex min-h-0 flex-col gap-1 p-3'>
      <button type='button' className={`${rowClass(selection.kind === 'all')} pl-1.5`} onClick={() => onSelect({ kind: 'all' })}>
        <Library size={15} className='shrink-0' />
        <span className='flex-1 truncate text-left font-medium'>All {noun.many}</span>
        <span className='text-[11px] tabular-nums text-muted-foreground'>{totalCount}</span>
      </button>

      <ul className='flex flex-col gap-px'>{childFolders(tree, null).map((folder) => renderFolder(folder, 0))}</ul>

      <button type='button' className={`${rowClass(selection.kind === 'unfiled')} pl-1.5`} onClick={() => onSelect({ kind: 'unfiled' })}>
        <Inbox size={15} className='shrink-0' />
        <span className='flex-1 truncate text-left'>Unfiled</span>
        <span className='text-[11px] tabular-nums text-muted-foreground'>{unfiledCount}</span>
      </button>

      <Button variant='toolbar' size='sm' className='mt-2 self-start' onClick={() => startNaming({ mode: 'new', parentId: null })}>
        <FolderPlus size={13} />
        New folder
      </Button>

      <FolderNameDialog
        key={namingKey}
        open={naming !== null}
        title={naming?.mode === 'rename' ? 'Rename folder' : naming?.parentId ? 'New subfolder' : 'New folder'}
        description={naming?.mode === 'rename' ? 'The number in front of it follows its position.' : noun === LESSON_NOUN ? 'Folders organise your lessons; learners see them beside a lesson.' : `Folders organise your ${noun.many}.`}
        initialName={naming?.mode === 'rename' && Object.hasOwn(tree.folders, naming.folderId) ? tree.folders[naming.folderId].name : ''}
        confirmLabel={naming?.mode === 'rename' ? 'Rename' : 'Create'}
        onSubmit={(name) => void submitName(name)}
        onOpenChange={(next) => !next && setNaming(null)}
      />
      <MoveToFolderDialog
        open={movingFolder !== null}
        tree={tree}
        title='Move folder'
        description={`Choose where “${movingFolder?.name ?? ''}” goes. It keeps its subfolders and ${noun.many}.`}
        noneLabel='Top level'
        currentId={movingFolder?.parentId ?? null}
        excludeId={moving ?? undefined}
        onPick={(parentId) => {
          if (moving === null) return;
          const id = moving;
          void onEdit((current) => moveFolder(current, id, parentId)).then((moved) => moved && parentId && onToggle(parentId, true));
        }}
        onOpenChange={(next) => !next && setMoving(null)}
      />
      <DeleteFolderDialog
        tree={tree}
        folderId={deleting}
        noun={noun}
        // A selection inside the deleted branch falls back to All lessons in LessonsHome.
        onConfirm={(id) => void onEdit((current) => deleteFolder(current, id, noun))}
        onOpenChange={(next) => !next && setDeleting(null)}
      />
    </nav>
  );
}
