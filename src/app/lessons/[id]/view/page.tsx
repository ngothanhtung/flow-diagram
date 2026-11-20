import type { Metadata } from 'next';
import { LessonViewer } from '@/components/lessons/LessonViewer';

export const metadata: Metadata = {
  title: 'Lesson — X Flow Tool',
  description: 'Read-only player for a shared X Flow Tool lesson.',
};

export default async function LessonViewRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LessonViewer lessonId={id} />;
}
