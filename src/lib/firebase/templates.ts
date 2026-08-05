'use client';

import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore';
import type { FlowDocumentJSON } from '../flowchart-types';
import { firestore } from './client';

/** A template stored in the shared `templates` collection. Managed by
 *  administrators; every signed-in user can read them. */
export interface StoredTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  document: FlowDocumentJSON;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

function templatesCollection() {
  return collection(firestore, 'templates');
}

function cleanDocument(document: FlowDocumentJSON): FlowDocumentJSON {
  // Firestore rejects undefined values; a JSON round-trip strips them.
  return JSON.parse(JSON.stringify(document)) as FlowDocumentJSON;
}

export async function listTemplates(): Promise<StoredTemplate[]> {
  const snapshot = await getDocs(templatesCollection());
  const templates = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as StoredTemplate);
  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTemplateById(templateId: string): Promise<StoredTemplate | null> {
  if (!templateId) return null;
  const snapshot = await getDoc(doc(templatesCollection(), templateId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as StoredTemplate;
}

export async function createTemplate(name: string, category: string, description: string, document: FlowDocumentJSON): Promise<string> {
  const reference = await addDoc(templatesCollection(), {
    name,
    category,
    description,
    document: cleanDocument(document),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}

export async function saveTemplate(templateId: string, name: string, category: string, description: string, document: FlowDocumentJSON): Promise<void> {
  if (!templateId) throw new Error('A template id is required.');
  await setDoc(
    doc(templatesCollection(), templateId),
    {
      name,
      category,
      description,
      document: cleanDocument(document),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function deleteTemplate(templateId: string) {
  return deleteDoc(doc(templatesCollection(), templateId));
}
