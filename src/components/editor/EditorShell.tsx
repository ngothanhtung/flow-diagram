'use client';

import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { EditorCanvas } from '@/components/editor/EditorCanvas';
import { EditorInfoPanels, InspectorSidebar } from '@/components/editor/InspectorSidebar';
import { PlaybackControls } from '@/components/editor/PlaybackControls';
import { ThemeToggle } from '@/components/theme-toggle';
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
  const infoOpen = useEditorStore((state) => state.infoOpen);
  const playback = useExecutionPlayback(document);

  return (
    <div className={['flex flex-col bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100', fullScreen ? 'h-screen' : 'h-full'].join(' ')}>
      <header className='flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-white/5 px-3 py-3 sm:px-6 sm:py-4'>
        <div className='flex min-w-0 flex-wrap items-center gap-2 sm:gap-3'>
          <div className='grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/40'>{icon}</div>
          <div className='min-w-0'>
            <h1 className='hidden text-base font-semibold md:block'>X Flow Tool</h1>
            {subtitle}
          </div>
          {fileMenu}
          {actions}
        </div>

        <div className='flex flex-wrap items-center justify-end gap-2'>
          <PlaybackControls runMode={playback.runMode} repeatEnabled={playback.repeatEnabled} stepCount={playback.orderedGroups.length} />
          <Button variant='toolbar' size='lg' nativeButton={false} render={<Link href='/help' title='User guide' />}>
            <BookOpen size={13} />
            <span className='hidden sm:inline'>Help</span>
          </Button>
          <ThemeToggle variant='toolbar' size='icon-lg' />
          {headerEnd}
        </div>
      </header>

      {subBar}
      {children}

      {/* The inspector is a drawer floating over the canvas, so the canvas
          always owns the full width. */}
      <main className='min-h-0 flex-1 overflow-hidden'>
        <EditorCanvas
          document={document}
          activeNodeIds={playback.active}
          runningEdgeIds={playback.runningEdgeIds}
          nodeExecutionStates={playback.nodeExecutionStates}
          edgeExecutionStates={playback.edgeExecutionStates}
          effectsPaused={playback.runMode === 'static'}
        />

        <InspectorSidebar document={document} ariaLabel={inspectorLabel}>
          {infoOpen && <EditorInfoPanels category={info.category} title={info.title} description={info.description} note={info.note} document={document} />}
        </InspectorSidebar>
      </main>
    </div>
  );
}
