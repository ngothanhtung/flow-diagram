import type { Metadata } from 'next';
import { AdminTemplatesPage } from '@/components/admin/TemplatesAdminTable';

export const metadata: Metadata = {
  title: 'Admin · Templates — Flowgram Tools',
  description: 'Manage the shared template library that every user loads from.',
};

export default function AdminTemplatesRoute() {
  return <AdminTemplatesPage />;
}
