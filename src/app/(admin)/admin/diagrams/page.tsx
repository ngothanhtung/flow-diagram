import type { Metadata } from 'next';
import { AdminDiagramsPage } from '@/components/admin/DiagramsAdminTable';

export const metadata: Metadata = {
  title: 'Admin · Diagrams — X Flow Tool',
  description: 'Read-only overview of every stored diagram across all users.',
};

export default function AdminDiagramsRoute() {
  return <AdminDiagramsPage />;
}
