'use client';

import { ChevronRight, CircleCheck, FileText } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { FolderIcon } from '@/components/lessons/FolderIcon';
import { folderProgress } from '@/lib/lesson/lesson-progress';
import { childFolders, folderLessons, folderNumber, pathTo, readingOrder, type LessonTree } from '@/lib/lesson/lesson-tree';

/**
 * The Course sidebar beside a Lesson being viewed: the owner's Lesson tree
 * (their public copy for anyone else), the current Lesson highlighted and
 * its folders opened, ✓ for Lessons finished in this browser, and done/total
 * per folder. Unfiled Lessons are not part of the course.
 */
export function CourseSidebar({ tree, currentId, done, showPrivate }: { tree: LessonTree; currentId: string; done: ReadonlySet<string>; showPrivate: boolean }) {
  // Opened: the path to the current Lesson. Remounted per Lesson by its parent.
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set(pathTo(tree, currentId)));
  const total = readingOrder(tree).length;

  const toggle = (id: string) =>
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderFolder = (folder: ReturnType<typeof childFolders>[number], depth: number) => {
    const open = openIds.has(folder.id);
    const progress = folderProgress(tree, folder.id, done);
    if (progress.total === 0) return null;
    return (
      <li key={folder.id}>
        <button
          type='button'
          aria-expanded={open}
          onClick={() => toggle(folder.id)}
          className='flex w-full min-w-0 items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm text-foreground/90 transition hover:bg-accent/60'
          style={{ paddingLeft: `${0.25 + depth * 0.85}rem` }}
          title={`${folderNumber(tree, folder.id)} ${folder.name}`}
        >
          <ChevronRight size={14} className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
          <FolderIcon color={folder.color} size={14} className='shrink-0' />
          <span className='min-w-0 flex-1 truncate font-medium'>
            <span className='tabular-nums text-muted-foreground'>{folderNumber(tree, folder.id)}</span> {folder.name}
          </span>
          <span className='shrink-0 text-[11px] tabular-nums text-muted-foreground'>
            {progress.done}/{progress.total}
          </span>
        </button>
        {open && (
          <ul>
            {childFolders(tree, folder.id).map((child) => renderFolder(child, depth + 1))}
            {folderLessons(tree, folder.id).map((lesson) => {
              const current = lesson.id === currentId;
              const finished = done.has(lesson.id);
              return (
                <li key={lesson.id}>
                  <Link
                    href={`/lessons/${lesson.id}/view`}
                    aria-current={current ? 'page' : undefined}
                    className={`flex min-w-0 items-center gap-2 rounded-md py-1.5 pr-2 text-sm transition ${current ? 'bg-sky-500/15 font-medium text-foreground ring-1 ring-sky-400/40' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'}`}
                    style={{ paddingLeft: `${1.5 + depth * 0.85}rem` }}
                    title={lesson.title}
                  >
                    {finished ? <CircleCheck size={14} className='shrink-0 text-emerald-600 dark:text-emerald-400' aria-label='Done' /> : <FileText size={14} className='shrink-0 opacity-70' />}
                    <span className='min-w-0 flex-1 truncate'>{lesson.title || 'Untitled lesson'}</span>
                    {showPrivate && !lesson.public && <span className='shrink-0 rounded px-1 text-[9px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-amber-500/40 dark:text-amber-300'>Private</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

  return (
    <nav aria-label='Course' className='flex min-h-0 flex-col'>
      <div className='flex items-baseline justify-between gap-2 px-3 pt-3 pb-2'>
        <span className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>Course</span>
        <span className='text-[11px] text-muted-foreground'>{total} lessons</span>
      </div>
      <ul className='min-h-0 flex-1 overflow-y-auto px-2 pb-3'>{childFolders(tree, null).map((folder) => renderFolder(folder, 0))}</ul>
    </nav>
  );
}
