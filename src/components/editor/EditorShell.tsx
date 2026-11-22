'use client';

import { BookOpen, Redo2, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ResizableAside } from '@/components/editor/ResizableAside';
import { EditorCanvas } from '@/components/editor/EditorCanvas';
import { EditorInfoPanels, InspectorSidebar } from '@/components/editor/InspectorSidebar';
import { PlaybackControls } from '@/components/editor/PlaybackControls';
import { PresentButton } from '@/components/present/PresentButton';
import { ShortcutsDialog } from '@/components/editor/ShortcutsDialog';
import { useEditorShortcuts } from '@/components/editor/use-editor-shortcuts';
import { ThemeToggle } from '@/components/theme-toggle';
import { selectCanRedo, selectCanUndo, useEditorStore } from '@/lib/editor-store';
import type { FlowDocumentJSON } from '@/lib/flowchart-types';
import type { ElementLook } from '@/lib/lesson/lesson-types';
import { useExecutionPlayback } from '@/lib/use-execution-playback';
import { useShortcutLabel } from '@/lib/use-is-mac';

export interface EditorInfo {
  category: string;
  title: string;
  description: string;
  /** One-line note under the summary, specific to this surface. */
  note: string;
}

/** Lesson mode: the canvas shows a derived document with per-element looks,
 *  every Line animates continuously (no Replay), and a side panel plus a
 *  footer frame it. The Inspector still edits the raw Diagram (`document`). */
export interface EditorLessonSurface {
  canvasDocument: FlowDocumentJSON;
  looks: Record<string, ElementLook>;
  hints: Record<string, string>;
  leftPanel: ReactNode;
  /** Right of the canvas (the Narration preview), with the docked Inspector, when open, beyond it at the right edge. */
  rightPanel?: ReactNode;
  footer: ReactNode;
  /** True while the Preview covers the editor: the Inspector steps aside (the selection is kept). */
  inspectorHidden?: boolean;
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
  /** What ⌘S does — the surface's own Save (diagram or template). */
  onSave?: () => void;
  /** Lesson mode (see `EditorLessonSurface`); absent in the Diagram and Template editors. */
  lesson?: EditorLessonSurface;
}

/**
 * The frame every editing surface shares: header, playback controls,
 * canvas, inspector sidebar and the Info panels. A surface supplies only
 * what genuinely differs — branding, its File menu, its action buttons,
 * its persistence dialogs.
 */
export function EditorShell({ document, icon, subtitle, fileMenu, actions, headerEnd, subBar, info, inspectorLabel, fullScreen = false, children, onSave, lesson }: EditorShellProps) {
  const infoOpen = useEditorStore((state) => state.infoOpen);
  const diagramName = useEditorStore((state) => state.currentDiagramName);
  const playback = useExecutionPlayback(document);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // The one keyboard handler for both editors (the Viewer has none).
  useEditorShortcuts({ onSave, onShowShortcuts: () => setShortcutsOpen(true) });

  return (
    <div className={['flex flex-col bg-background text-foreground', fullScreen ? 'h-screen' : 'h-full'].join(' ')}>
      <header className='flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-3 py-3 sm:px-6 sm:py-4'>
        <div className='flex min-w-0 flex-wrap items-center gap-2 sm:gap-3'>
          <div className='grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/40'>{icon}</div>
          <div className='min-w-0'>
            <h1 className='hidden text-base font-semibold md:block'>X Flow Tool</h1>
            {subtitle}
          </div>
          {/* File menu and actions (Save, Public/Private…) wrap as one
              group rather than as loose siblings of the branding — on a
              narrow viewport that keeps them together on their own line
              instead of splitting mid-group (e.g. File + Public on one
              row, Save stranded alone on the next). */}
          <div className='flex flex-wrap items-center gap-2 sm:gap-3'>
            {fileMenu}
            <UndoRedoButtons />
            {actions}
          </div>
        </div>

        <div className='flex flex-wrap items-center justify-end gap-2'>
          {!lesson && <PlaybackControls runMode={playback.runMode} repeatEnabled={playback.repeatEnabled} stepCount={playback.orderedGroups.length} />}
          {!lesson && <PresentButton document={document} name={diagramName || 'Untitled diagram'} />}
          <Button variant='toolbar' size='lg' nativeButton={false} render={<Link href='/help' title='User guide — press ? for keyboard shortcuts' />}>
            <BookOpen size={13} />
            <span className='hidden sm:inline'>Help</span>
          </Button>
          <ThemeToggle variant='toolbar' size='icon-lg' />
          {headerEnd}
        </div>
      </header>

      {subBar}
      {children}
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      {/* canvas · (Lesson: Narration preview ·) Inspector — docked columns of one look, the Inspector at the right edge. */}
      <main className='flex min-h-0 flex-1 overflow-hidden'>
        {lesson && <ResizableAside label='the lesson panel'>{lesson.leftPanel}</ResizableAside>}
        <div className='relative min-h-0 min-w-0 flex-1'>
          {lesson ? (
            <EditorCanvas
              document={lesson.canvasDocument}
              activeNodeIds={[]}
              runningEdgeIds={null}
              nodeExecutionStates={undefined}
              edgeExecutionStates={{}}
              effectsPaused={false}
              elementLooks={lesson.looks}
              elementHints={lesson.hints}
            />
          ) : (
            <EditorCanvas
              document={document}
              activeNodeIds={playback.active}
              runningEdgeIds={playback.runningEdgeIds}
              nodeExecutionStates={playback.nodeExecutionStates}
              edgeExecutionStates={playback.edgeExecutionStates}
              effectsPaused={playback.runMode === 'static'}
            />
          )}

        </div>
        {/* Lesson mode: canvas · Narration preview · Inspector — two docked
            columns of one look, the Inspector at the right edge. */}
        {lesson?.rightPanel && (
          <aside aria-label='Narration preview' className='hidden w-80 shrink-0 border-l border-border bg-card/40 lg:block xl:w-96'>
            {lesson.rightPanel}
          </aside>
        )}
        <InspectorSidebar document={document} ariaLabel={inspectorLabel} hidden={lesson?.inspectorHidden}>
          {infoOpen && <EditorInfoPanels category={info.category} title={info.title} description={info.description} note={info.note} document={document} />}
        </InspectorSidebar>
      </main>
      {lesson?.footer}
    </div>
  );
}

/** Undo / Redo for the document — the same history in both editors.
 *  Each button disables itself when its stack is empty. */
function UndoRedoButtons() {
  const canUndo = useEditorStore(selectCanUndo);
  const canRedo = useEditorStore(selectCanRedo);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const undoKeys = useShortcutLabel(['mod', 'Z']);
  const redoKeys = useShortcutLabel(['shift', 'mod', 'Z']);
  return (
    <div className='flex items-center gap-1'>
      <Button variant='toolbar' size='icon-lg' disabled={!canUndo} onClick={undo} title={`Undo (${undoKeys})`} aria-label='Undo'>
        <Undo2 size={14} />
      </Button>
      <Button variant='toolbar' size='icon-lg' disabled={!canRedo} onClick={redo} title={`Redo (${redoKeys})`} aria-label='Redo'>
        <Redo2 size={14} />
      </Button>
    </div>
  );
}
