'use client';

import { FileQuestion } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { AuthLoadingScreen } from '@/components/auth/LoginForm';
import { LessonPlayer } from '@/components/lessons/LessonPlayer';
import { findPublicLessonById, loadLesson } from '@/lib/firebase/lessons';
import { normalizeLessonDocument } from '@/lib/lesson/lesson-normalize';
import type { LessonDocumentJSON } from '@/lib/lesson/lesson-types';

type State =
  | { status: 'loading' }
  | { status: 'ready'; lesson: LessonDocumentJSON }
  | { status: 'not-found' | 'invalid' | 'error' };

/**
 * Read-only lesson page (`/lessons/{id}/view`). A signed-in user's own
 * lesson wins, else the public mirror (signed out works). Not behind
 * AuthGate, like the Diagram viewer.
 */
export function LessonViewer({ lessonId }: { lessonId: string }) {
  const { user, loading } = useAuth();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const resolve = async (): Promise<unknown | null> => {
      if (user) {
        const own = await loadLesson(user.uid, lessonId).catch(() => null);
        if (own) return own.document;
      }
      const shared = await findPublicLessonById(lessonId);
      return shared ? shared.document : null;
    };
    resolve()
      .then((raw) => {
        if (cancelled) return;
        if (raw === null) return setState({ status: 'not-found' });
        const result = normalizeLessonDocument(raw);
        setState(result.ok ? { status: 'ready', lesson: result.lesson } : { status: 'invalid' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId, user, loading]);

  if (loading || state.status === 'loading') return <AuthLoadingScreen />;
  if (state.status === 'ready') return <LessonPlayer lesson={state.lesson} />;

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
