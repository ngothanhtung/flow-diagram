import type { Metadata } from 'next';
import { AuthGate } from '@/components/auth/AuthGate';
import { DiagramsHome } from '@/components/diagrams/DiagramsHome';

export const metadata: Metadata = {
  title: 'X Flow Tool — Your diagrams',
  description: 'List, open, create and delete your flow diagrams.',
};

export default function Home() {
  return (
    <AuthGate>
      <DiagramsHome />
    </AuthGate>
  );
}
