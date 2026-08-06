'use client';

import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EditorCanvas } from '@/components/editor/EditorCanvas';
import { EditorInfoPanels, InspectorSidebar } from '@/components/editor/InspectorSidebar';
import { PlaybackControls } from '@/components/editor/PlaybackControls';
import { useEditorStore } from '@/lib/editor-store';
import type { FlowDocumentJSON } from '@/lib/flowchart-types';
import { useExecutionPlayback } from '@/lib/use-execution-playback';

export interface EditorInfo {
  category: string;
  title: string;
  description: string;
  /** One-line note under the summary, specific to this surface. */
  note: string;
}

interface EditorShellProps {
  document: FlowDocumentJSON;
  /** Logo tile glyph — the only branding difference between surfaces. */
  icon: ReactNode;
  /** Second line in the header: a diagram name editor, a template name… */
  subtitle: ReactNode;
  /** File menu, built from `EditorFileMenu`. */
  fileMenu: ReactNode;
  /** Buttons that sit right of the File menu (Save, Public/Private…). */
  actions: ReactNode;
  /** Trailing header slot after the playback controls (user menu…). */
  headerEnd?: ReactNode;
  /** Optional strip under the header (template meta inputs…). */
  subBar?: ReactNode;
  info: EditorInfo;
  inspectorLabel: string;
  /** The route owns the viewport (`/diagrams/[id]/edit`) vs. sits inside
   *  an admin layout that already sized it. */
  fullScreen?: boolean;
  /** Dialogs owned by the surface (share, template picker, reset…). */
  children?: ReactNode;
}

/**
 * The frame every editing surface shares: header, playback controls,
 * canvas, inspector sidebar and the Info panels. A surface supplies only
 * what genuinely differs — branding, its File menu, its action buttons,
 * its persistence dialogs.
 */
export function EditorShell({ document, icon, subtitle, fileMenu, actions, headerEnd, subBar, info, inspectorLabel, fullScreen = false, children }: EditorShellProps) {
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedEdgeId = useEditorStore((state) => state.selectedEdgeId);
  const infoOpen = useEditorStore((state) => state.infoOpen);
  const playback = useExecutionPlayback(document);
  const hasSidebar = selectedNodeId !== null || selectedEdgeId !== null || infoOpen;

  return (
    <div className={['flex flex-col bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100', fullScreen ? 'h-screen' : 'h-full'].join(' ')}>
      <header className='flex items-center justify-between border-b border-white/5 px-6 py-4'>
        <div className='flex items-center gap-3'>
          <div className='grid h-9 w-9 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/40'>{icon}</div>
          <div>
            <h1 className='text-base font-semibold'>X Flow Tool</h1>
            {subtitle}
          </div>
          {fileMenu}
          {actions}
        </div>

        <div className='flex items-center gap-2'>
          <PlaybackControls runMode={playback.runMode} repeatEnabled={playback.repeatEnabled} stepCount={playback.orderedGroups.length} />
          <Link href='/help' title='User guide' className='inline-flex h-9 items-center gap-1.5 rounded-md border border-white/10 bg-black/25 px-3 text-xs font-semibold text-zinc-300 transition hover:bg-white/8 dark:bg-input/30 dark:hover:bg-input/50'>
            <BookOpen size={13} />
            Help
          </Link>
          {headerEnd}
        </div>
      </header>

      {subBar}
      {children}

      <main className={['grid min-h-0 flex-1 gap-2 overflow-hidden', hasSidebar ? 'grid-cols-[1fr_320px]' : 'grid-cols-1'].join(' ')}>
        <EditorCanvas document={document} activeNodeIds={playback.active} runningEdgeIds={playback.runningEdgeIds} nodeExecutionStates={playback.nodeExecutionStates} edgeExecutionStates={playback.edgeExecutionStates} />

        {hasSidebar && (
          <InspectorSidebar document={document} ariaLabel={inspectorLabel}>
            {infoOpen && <EditorInfoPanels category={info.category} title={info.title} description={info.description} note={info.note} document={document} />}
          </InspectorSidebar>
        )}
      </main>
    </div>
  );
}
