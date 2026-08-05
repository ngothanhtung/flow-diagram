import type { Metadata } from 'next';
import { DiagramEditor } from '@/components/editor/DiagramEditor';

export const metadata: Metadata = {
  title: 'Edit diagram — X Flow Tool',
  description: 'Edit one of your diagrams in the flow editor.',
};

export default async function DiagramEditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Keyed by id so switching diagrams through the URL remounts the
  // editor with a fresh load cycle.
  return <DiagramEditor key={id} diagramId={id} />;
}
