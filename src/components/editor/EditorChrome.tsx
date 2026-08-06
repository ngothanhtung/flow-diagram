'use client';

import { FileJson, FilePlus, FileQuestion, FolderOpen, LayoutTemplate, LoaderCircle, RotateCcw, Save } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from '@/components/ui/navigation-menu';
import { useEditorStore } from '@/lib/editor-store';

/** File menu shell. Items are passed as `<FileMenuItem>` children so each
 *  editor keeps its own commands while the chrome stays identical. */
export function FileMenu({ children }: { children: ReactNode }) {
  return (
    <NavigationMenu className='max-w-none'>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger className='h-9 gap-1.5 rounded-lg border border-white/10 bg-black/25 px-3 text-xs font-semibold text-zinc-300 hover:bg-white/8 data-popup-open:bg-white/8 data-popup-open:text-zinc-100 dark:bg-input/30 dark:hover:bg-input/50 dark:data-popup-open:bg-input/50'>
            File
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className='grid w-56 gap-0.5 p-1'>{children}</ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

export function FileMenuItem({ href, onClick, disabled, tone = 'default', icon, children }: { href?: string; onClick?: () => void; disabled?: boolean; tone?: 'default' | 'danger' | 'accent'; icon: ReactNode; children: ReactNode }) {
  const toneClass = tone === 'danger' ? 'text-rose-300' : tone === 'accent' ? 'text-orange-300' : 'text-zinc-200';
  return (
    <li>
      <NavigationMenuLink closeOnClick render={href ? <Link href={href} /> : <button type='button' disabled={disabled} onClick={onClick} />} className={`gap-2 text-xs ${toneClass} disabled:pointer-events-none disabled:opacity-50`}>
        {icon}
        {children}
      </NavigationMenuLink>
    </li>
  );
}

export function FileMenuSeparator() {
  return <li className='my-1 h-px bg-white/8' />;
}

/**
 * The File menu every editing surface has: New, New from template, Open,
 * Export to JSON, Reset. `afterOpen` / `afterExport` let a surface slot
 * its own commands into the two places they belong.
 */
export function EditorFileMenu({
  onNew,
  newDisabled,
  onNewFromTemplate,
  openHref,
  onExport,
  onReset,
  afterOpen,
  afterExport,
}: {
  onNew: () => void;
  newDisabled?: boolean;
  onNewFromTemplate: () => void;
  openHref: string;
  onExport: () => void;
  onReset: () => void;
  afterOpen?: ReactNode;
  afterExport?: ReactNode;
}) {
  return (
    <FileMenu>
      <FileMenuItem icon={<FilePlus size={14} />} disabled={newDisabled} onClick={onNew}>
        New
      </FileMenuItem>
      <FileMenuItem icon={<LayoutTemplate size={14} />} onClick={onNewFromTemplate}>
        New from template
      </FileMenuItem>
      <FileMenuItem icon={<FolderOpen size={14} />} href={openHref}>
        Open
      </FileMenuItem>
      {afterOpen}
      <FileMenuSeparator />
      <FileMenuItem icon={<FileJson size={14} />} onClick={onExport}>
        Export to JSON
      </FileMenuItem>
      {afterExport}
      <FileMenuSeparator />
      <FileMenuItem icon={<RotateCcw size={14} />} tone='danger' onClick={onReset}>
        Reset
      </FileMenuItem>
    </FileMenu>
  );
}

/** Save button with the amber unsaved-changes dot. */
export function SaveButton({ saving, dirty, onSave }: { saving: boolean; dirty: boolean; onSave: () => void }) {
  return (
    <Button variant='outline' disabled={saving} onClick={onSave} title='Save' className='h-9 border-white/10 bg-black/25 text-xs font-semibold text-zinc-300 hover:bg-white/8 dark:bg-input/30 dark:hover:bg-input/50'>
      {saving ? <LoaderCircle size={13} className='animate-spin' /> : <Save size={13} />}
      Save
      {dirty && <span className='size-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(180,83,9,.8)]' />}
    </Button>
  );
}

/** Download the current document as a `.json` file. */
export function downloadDocumentJson(document: object, filename: string) {
  const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement('a');
  anchor.href = url;
  anchor.download = `${filename.replace(/[^a-z0-9-_]+/gi, '-')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Confirmation for the destructive "Reset" command. Reverting is the
 *  store's job, so the dialog owns the whole interaction. */
export function ResetCanvasDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const resetToTemplate = useEditorStore((state) => state.resetToTemplate);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className='border border-white/8 bg-zinc-950'>
        <AlertDialogHeader>
          <AlertDialogMedia className='bg-rose-400/10 text-rose-300'>
            <RotateCcw />
          </AlertDialogMedia>
          <AlertDialogTitle>Reset canvas?</AlertDialogTitle>
          <AlertDialogDescription>All unsaved changes on the current canvas will be lost and it will revert to the last loaded state. This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant='destructive'
            onClick={() => {
              resetToTemplate();
              // Base UI action buttons don't auto-close when given a
              // custom onClick — close explicitly.
              onOpenChange(false);
            }}
          >
            Reset
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Full-surface placeholder while a document loads, or when it can't be. */
export function EditorStatusScreen({ loading, title, description, backHref, backLabel, fullScreen = false }: { loading: boolean; title: string; description: string; backHref: string; backLabel: string; fullScreen?: boolean }) {
  return (
    <div className={['grid place-items-center bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100', fullScreen ? 'h-screen' : 'h-full'].join(' ')}>
      <div className='flex max-w-sm flex-col items-center gap-4 rounded-xl bg-zinc-900/70 px-8 py-10 text-center'>
        <div className='grid size-12 place-items-center rounded-full bg-sky-500/15 ring-1 ring-sky-400/40'>
          {loading ? <LoaderCircle size={22} className='animate-spin text-sky-300' /> : <FileQuestion size={22} className='text-sky-300' />}
        </div>
        <div>
          <h1 className='text-sm font-semibold'>{title}</h1>
          <p className='mt-1.5 text-xs leading-relaxed text-zinc-500'>{description}</p>
        </div>
        <Link href={backHref} className='inline-flex h-8 items-center gap-1.5 rounded-md bg-white/5 px-3 text-xs font-semibold text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10'>
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
