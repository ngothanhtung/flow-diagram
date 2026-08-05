import type { Metadata } from 'next';
import { TemplateEditor } from '@/components/admin/TemplateEditor';

export const metadata: Metadata = {
  title: 'Admin · Edit template — X Flow Tool',
  description: 'Edit a template from the shared library and save it back to Firestore.',
};

export default async function AdminTemplateEditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TemplateEditor templateId={id} />;
}
