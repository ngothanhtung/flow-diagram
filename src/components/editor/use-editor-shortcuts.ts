'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { toast } from 'sonner';
import { buildFragment, parseFragment, serializeFragment } from '@/lib/clipboard-fragment';
import { useEditorStore } from '@/lib/editor-store';
import { nudgeDistance, resolveShortcut } from '@/lib/shortcuts';
import { detectMac } from '@/lib/use-is-mac';

/**
 * Where a key press (or clipboard event) happened, as far as shortcuts care.
 *
 * - `all`: the editing surface — canvas, header, the inspector drawer.
 * - `history`: a dialog that edits the document live and opted in with
 *   `data-shortcuts="history"` (the Line styles palette). It is modal, so
 *   the header's Undo/Redo can't be reached while it is open; ⌘Z/⌘⇧Z and
 *   ⌘S work there, everything else stays the dialog's.
 * - `none`: any other dialog, menu, listbox or popover — Escape, arrows
 *   and Delete mean something to it, and nothing behind a modal should
 *   change while it is up.
 */
type Scope = 'all' | 'history' | 'none';

/** Anything that is (or lives in) a popup. `[data-shortcuts]` marks the
 *  popups that opt back in: the inspector drawer (`all`) and the palette
 *  dialog (`history`). Nearest match wins. */
const POPUP_SELECTOR = ['[data-shortcuts]', '[role=dialog]', '[role=alertdialog]', '[role=menu]', '[role=menubar]', '[role=listbox]', '[data-slot=popover-content]', '[data-slot=select-content]', '[data-slot=dropdown-menu-content]', '[data-slot=navigation-menu-content]', '[data-slot=navigation-menu-viewport]', '[data-slot=navigation-menu-popup]'].join(',');

/** Where typing goes: here every key keeps its native meaning. */
const FIELD_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role=textbox], [role=searchbox], [role=spinbutton], [role=combobox], [role=slider]';

/** Widgets that move focus (or a value) with the arrow keys. */
const ARROW_WIDGET_SELECTOR = '[role=radiogroup], [role=radio], [role=tablist], [role=tab], [role=listbox], [role=option], [role=menu], [role=menuitem], [role=tree], [role=grid], [data-slot=toggle-group]';

interface Context {
  scope: Scope;
  inField: boolean;
  inArrowWidget: boolean;
}

function contextOf(target: EventTarget | null): Context {
  const element = target instanceof Element ? target : null;
  const popup = element?.closest(POPUP_SELECTOR) ?? null;
  let scope: Scope = 'all';
  if (popup) {
    const optIn = popup.getAttribute('data-shortcuts');
    scope = optIn === 'all' || optIn === 'history' ? optIn : 'none';
  } else if (globalThis.document.querySelector('[role=dialog][aria-modal=true], [role=alertdialog]')) {
    // Focus is outside every popup, yet a modal is open (focus sat on the
    // body when it opened): the modal still owns the keyboard.
    scope = 'none';
  }
  return {
    scope,
    inField: Boolean(element?.closest(FIELD_SELECTOR)),
    inArrowWidget: Boolean(element?.closest(ARROW_WIDGET_SELECTOR)),
  };
}

/** Clipboard events act only where every shortcut does: the editing
 *  surface, outside any field. */
function clipboardContextAllows(target: EventTarget | null): boolean {
  const context = contextOf(target);
  return context.scope === 'all' && !context.inField;
}

/** True while the user has page text selected (the JSON view, the Info
 *  panel…) — then ⌘C copies that text, as it would anywhere else. */
function hasTextSelection(): boolean {
  const selection = globalThis.getSelection?.();
  return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
}

/** The clipboard text for the current selection, or null. */
function selectionClipboardText(): string | null {
  const { doc, selectedNodeIds } = useEditorStore.getState();
  const fragment = buildFragment(doc, selectedNodeIds);
  return fragment ? serializeFragment(fragment) : null;
}

function pasteText(text: string) {
  const parsed = parseFragment(text);
  if (!parsed.ok) {
    toast.error('Nothing pasted', { description: parsed.error });
    return;
  }
  const before = useEditorStore.getState().doc.edges.length;
  const ids = useEditorStore.getState().pasteFragment(parsed.fragment);
  const lines = useEditorStore.getState().doc.edges.length - before;
  toast.success(`Pasted ${ids.length} ${ids.length === 1 ? 'Element' : 'Elements'}${lines > 0 ? ` and ${lines} ${lines === 1 ? 'Line' : 'Lines'}` : ''}`);
}

export interface EditorShortcutOptions {
  /** ⌘S. Each editor supplies its own save (diagram vs. template). */
  onSave?: () => void;
  /** `?` — open the cheat sheet. */
  onShowShortcuts: () => void;
}

/**
 * The editor's keyboard shortcuts and clipboard, mounted once by
 * `EditorShell` for both editing surfaces (never by the Viewer). Listens on
 * the window/document rather than a focusable canvas, because clicking the
 * SVG canvas leaves focus on the body.
 *
 * Copy/cut/paste ride the native `copy`/`cut`/`paste` events: they carry
 * `clipboardData`, which reads and writes the system clipboard without a
 * permission prompt. The keydown for ⌘C/⌘X/⌘V only arms a fallback — if
 * the browser fired no clipboard event for it (Safari with nothing
 * selected), the async Clipboard API does the same job a tick later.
 */
export function useEditorShortcuts({ onSave, onShowShortcuts }: EditorShortcutOptions) {
  const callbacks = useRef({ onSave, onShowShortcuts });
  useLayoutEffect(() => {
    callbacks.current = { onSave, onShowShortcuts };
  });

  useEffect(() => {
    const isMac = detectMac();
    const store = useEditorStore.getState;
    /** The open nudge gesture and the arrow keys holding it open. */
    let nudge: { gesture: number; keys: Set<string> } | null = null;
    /** Bumped by every clipboard event, so a keydown can tell whether the
     *  browser fired one for it. */
    let clipboardEvents = 0;

    const endNudge = () => {
      if (!nudge) return;
      store().endHistoryGesture(nudge.gesture);
      nudge = null;
    };

    const copySelection = (event: ClipboardEvent | null): boolean => {
      const text = selectionClipboardText();
      if (!text) return false;
      if (event?.clipboardData) {
        event.clipboardData.setData('text/plain', text);
        event.preventDefault();
      } else {
        void navigator.clipboard?.writeText(text).catch(() => toast.error('Could not copy', { description: 'The browser blocked clipboard access.' }));
      }
      return true;
    };

    const onCopy = (event: ClipboardEvent) => {
      clipboardEvents += 1;
      if (!clipboardContextAllows(event.target) || hasTextSelection()) return;
      copySelection(event);
    };

    const onCut = (event: ClipboardEvent) => {
      clipboardEvents += 1;
      if (!clipboardContextAllows(event.target) || hasTextSelection()) return;
      if (copySelection(event)) store().deleteSelection();
    };

    const onPaste = (event: ClipboardEvent) => {
      clipboardEvents += 1;
      if (!clipboardContextAllows(event.target)) return;
      if (!event.clipboardData) {
        void readClipboardFallback();
        return;
      }
      event.preventDefault();
      pasteText(event.clipboardData.getData('text/plain'));
    };

    const readClipboardFallback = async () => {
      try {
        pasteText((await navigator.clipboard?.readText()) ?? '');
      } catch {
        toast.error('Nothing pasted', { description: 'The browser blocked clipboard access.' });
      }
    };

    /** Runs the clipboard action itself if the browser fired no event. */
    const armClipboardFallback = (kind: 'copy' | 'cut' | 'paste') => {
      const seen = clipboardEvents;
      window.setTimeout(() => {
        if (clipboardEvents !== seen) return;
        if (kind === 'paste') void readClipboardFallback();
        else if (!hasTextSelection() && copySelection(null) && kind === 'cut') store().deleteSelection();
      }, 0);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      const action = resolveShortcut(event, isMac);
      if (!action) return;
      const context = contextOf(event.target);

      if (action.type === 'save') {
        // Never let the browser's "Save page" dialog open over the editor.
        event.preventDefault();
        if (context.scope === 'none') return;
        if (context.inField) {
          // A field may hold an uncommitted draft (titles commit on blur):
          // commit it first, then save what is now on screen.
          (globalThis.document.activeElement as HTMLElement | null)?.blur();
          window.setTimeout(() => callbacks.current.onSave?.(), 0);
          return;
        }
        callbacks.current.onSave?.();
        return;
      }

      if (context.inField || context.scope === 'none') return;

      if (action.type === 'undo' || action.type === 'redo') {
        event.preventDefault();
        if (action.type === 'undo') store().undo();
        else store().redo();
        return;
      }

      if (context.scope !== 'all') return;
      const state = store();

      switch (action.type) {
        case 'copy':
        case 'cut':
        case 'paste':
          armClipboardFallback(action.type);
          return;
        case 'delete':
          if (state.selectedNodeIds.length === 0 && !state.selectedEdgeId) return;
          event.preventDefault();
          state.deleteSelection();
          return;
        case 'duplicate':
          // Also blocks the browser's bookmark dialog.
          event.preventDefault();
          state.duplicateSelection();
          return;
        case 'select-all':
          event.preventDefault();
          state.selectAll();
          return;
        case 'nudge': {
          if (context.inArrowWidget || state.selectedNodeIds.length === 0) return;
          event.preventDefault();
          // A held key is one undo step: the gesture opens on the first
          // keydown and closes when the last arrow is released. Reopen it
          // if something else (a click) closed it meanwhile.
          if (!nudge || state.history.gesture?.id !== nudge.gesture) nudge = { gesture: state.beginHistoryGesture(), keys: new Set() };
          nudge.keys.add(event.key);
          const distance = nudgeDistance(action.large, state.canvasGrid);
          store().nudgeSelection(action.dx * distance, action.dy * distance);
          return;
        }
        case 'escape':
          // An armed draw tool is disarmed by the shape dock's own Esc
          // handler; only clear the selection when there's none.
          if (state.activeShape) return;
          if (state.selectedNodeIds.length === 0 && !state.selectedEdgeId) return;
          state.selectNode(null);
          state.selectEdge(null);
          return;
        case 'show-shortcuts':
          event.preventDefault();
          callbacks.current.onShowShortcuts();
          return;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!nudge) return;
      nudge.keys.delete(event.key);
      if (nudge.keys.size === 0) endNudge();
    };

    // Capture phase: the inspector drawer (Base UI) stops some keys, the
    // arrows among them, from bubbling out of it. Running first is safe
    // because `contextOf` already leaves fields, widgets and popups alone.
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', endNudge);
    globalThis.document.addEventListener('copy', onCopy);
    globalThis.document.addEventListener('cut', onCut);
    globalThis.document.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', endNudge);
      globalThis.document.removeEventListener('copy', onCopy);
      globalThis.document.removeEventListener('cut', onCut);
      globalThis.document.removeEventListener('paste', onPaste);
      endNudge();
    };
  }, []);
}
