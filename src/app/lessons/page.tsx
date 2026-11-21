import type { Metadata } from 'next';
import { AuthGate } from '@/components/auth/AuthGate';
import { LessonsHome } from '@/components/lessons/LessonsHome';

export const metadata: Metadata = {
  title: 'X Flow Tool — Your lessons',
  description: 'List, open, create, publish and delete your lessons.',
};

export default function LessonsPage() {
  return (
    <AuthGate>
      <LessonsHome />
    </AuthGate>
  );
}
