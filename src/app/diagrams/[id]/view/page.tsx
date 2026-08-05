import type { Metadata } from 'next';
import { DiagramViewer } from '@/components/viewer/DiagramViewer';

export const metadata: Metadata = {
  title: 'Diagram view — X Flow Tool',
  description: 'Read-only viewer for a shared flowgram diagram.',
};

export default async function DiagramViewRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DiagramViewer diagramId={id} />;
}
