import type { Metadata } from 'next';
import { DiagramsHome } from '@/components/diagrams/DiagramsHome';

export const metadata: Metadata = {
  title: 'X Flow Tool — Your diagrams',
  description: 'List, open, create and delete your flow diagrams.',
};

export default function Home() {
  return <DiagramsHome />;
}
