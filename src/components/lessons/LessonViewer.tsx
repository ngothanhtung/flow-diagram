'use client';

import { FileQuestion } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { AuthLoadingScreen } from '@/components/auth/LoginForm';
import { CourseSidebar } from '@/components/lessons/CourseSidebar';
import { LessonPlayer } from '@/components/lessons/LessonPlayer';
import { loadLessonTree, loadPublicLessonTree } from '@/lib/firebase/lesson-tree';
import { findPublicLessonById, loadLesson } from '@/lib/firebase/lessons';
import { loadDone, markDone, nextLessonId } from '@/lib/lesson/lesson-progress';
import { normalizeLessonDocument } from '@/lib/lesson/lesson-normalize';
import { pathTo, type LessonTree } from '@/lib/lesson/lesson-tree';
import type { LessonDocumentJSON } from '@/lib/lesson/lesson-types';

/** The Course sidebar's data: the owner's tree (theirs in full when they are viewing, else the public copy). */
interface Course {
  tree: LessonTree;
  isOwner: boolean;
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; lessonId: string; lesson: LessonDocumentJSON; course: Course | null }
  | { status: 'not-found' | 'invalid' | 'error' };

/** The tree is extra: a missing tree, a failed read or a Lesson that isn't in it all mean no sidebar. */
async function courseFor(lessonId: string, ownerUid: string, isOwner: boolean): Promise<Course | null> {
  try {
    const tree = isOwner ? await loadLessonTree(ownerUid) : await loadPublicLessonTree(ownerUid);
    if (!tree || pathTo(tree, lessonId).length === 0) return null;
    return { tree, isOwner };
  } catch {
    return null;
  }
}

/**
 * Read-only lesson page (`/lessons/{id}/view`). A signed-in user's own
 * lesson wins, else the public mirror (signed out works). Not behind
 * AuthGate, like the Diagram viewer.
 */
export function LessonViewer({ lessonId }: { lessonId: string }) {
  const { user, loading } = useAuth();
  const [state, setState] = useState<State>({ status: 'loading' });
  // Lessons finished in this browser. Read on the client only: the server
  // render shows the loading screen, which doesn't use it.
  const [done, setDone] = useState<ReadonlySet<string>>(() => (typeof window === 'undefined' ? new Set() : loadDone()));

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const resolve = async (): Promise<{ raw: unknown; ownerUid: string; isOwner: boolean } | null> => {
      if (user) {
        const own = await loadLesson(user.uid, lessonId).catch(() => null);
        if (own) return { raw: own.document, ownerUid: user.uid, isOwner: true };
      }
      const shared = await findPublicLessonById(lessonId);
      return shared ? { raw: shared.document, ownerUid: shared.ownerUid, isOwner: false } : null;
    };
    resolve()
      .then(async (found) => {
        if (cancelled) return;
        if (found === null) return setState({ status: 'not-found' });
        const result = normalizeLessonDocument(found.raw);
        if (!result.ok) return setState({ status: 'invalid' });
        const course = typeof found.ownerUid === 'string' && found.ownerUid ? await courseFor(lessonId, found.ownerUid, found.isOwner) : null;
        if (!cancelled) setState({ status: 'ready', lessonId, lesson: result.lesson, course });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId, user, loading]);

  const handleReachEnd = useCallback(() => setDone(markDone(lessonId)), [lessonId]);

  // Moving to another Lesson (sidebar, Next lesson) keeps this component: until
  // the new one has loaded, the previous one must not be shown under its id.
  if (loading || state.status === 'loading' || (state.status === 'ready' && state.lessonId !== lessonId)) return <AuthLoadingScreen />;
  if (state.status === 'ready') {
    const { course } = state;
    const next = course ? nextLessonId(course.tree, lessonId) : null;
    return (
      <LessonPlayer
        // A new Lesson (Course sidebar or Next lesson) starts at its first step.
        key={lessonId}
        lesson={state.lesson}
        onReachEnd={handleReachEnd}
        nextLessonHref={next ? `/lessons/${next}/view` : undefined}
        sidebar={course ? <CourseSidebar key={lessonId} tree={course.tree} currentId={lessonId} done={done} showPrivate={course.isOwner} /> : undefined}
      />
    );
  }

  const copy = {
    'not-found': ['Lesson not found', 'No lesson matches this id, or you do not have access to it.'],
    invalid: ["This lesson can't be displayed", 'Its content is damaged and could not be repaired.'],
    error: ['Could not load lesson', 'Check your connection and try again.'],
  }[state.status];

  return (
    <div className='grid h-screen place-items-center bg-background text-foreground'>
      <div className='flex max-w-sm flex-col items-center gap-4 rounded-xl bg-card px-8 py-10 text-center'>
        <div className='grid size-12 place-items-center rounded-full bg-sky-500/15 ring-1 ring-sky-400/40'>
          <FileQuestion size={22} className='text-sky-600 dark:text-sky-300' />
        </div>
        <div>
          <h1 className='text-sm font-semibold'>{copy[0]}</h1>
          <p className='mt-1.5 text-xs leading-relaxed text-muted-foreground'>{copy[1]}</p>
        </div>
        <div className='flex items-center gap-2'>
          <Link href='/' className='inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-semibold text-accent-foreground ring-1 ring-border transition hover:bg-accent/70'>
            Back to editor
          </Link>
          {!user && (
            <Link href='/' className='inline-flex h-8 items-center gap-1.5 rounded-md bg-sky-500/15 px-3 text-xs font-semibold text-sky-700 dark:text-sky-200 ring-1 ring-sky-400/40 transition hover:bg-sky-500/25'>
              Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
