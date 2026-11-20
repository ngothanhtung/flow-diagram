import type { Metadata } from 'next';
import { AuthGate } from '@/components/auth/AuthGate';
import { LessonEditor } from '@/components/lessons/LessonEditor';

export const metadata: Metadata = {
  title: 'Edit lesson — X Flow Tool',
  description: 'Edit one of your lessons: a diagram revealed and narrated lesson step by lesson step.',
};

export default async function LessonEditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Keyed by id so switching lessons through the URL remounts the editor
  // with a fresh load cycle (and closes the previous Lesson).
  return (
    <AuthGate>
      <LessonEditor key={id} lessonId={id} />
    </AuthGate>
  );
}
