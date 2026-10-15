'use client';

import { useCallback, useEffect, useRef, type FocusEvent, type FormEvent } from 'react';
import { useEditorStore } from '@/lib/editor-store';

/** The gesture this scope opened, and the field that opened it (if any). */
interface OwnedGesture {
  id: number;
  field: HTMLElement | null;
}

/**
 * Groups the edits made inside one region of the editor into undo steps
 * that match what the user did, rather than one step per store write.
 * Spread the returned handlers on the region's root element; React
 * delivers events from portaled children (dialogs, popovers) to it too.
 *
 * - **A press is one step.** Everything between pointerdown and the end
 *   of that press — a whole drag, resize, endpoint or bend-point drag, a
 *   slider drag, a click — folds into one gesture. The gesture closes a
 *   tick after pointerup, so the drop handler and the `click` that follow
 *   the release land inside it too.
 * - **A stretch of typing is one step.** The first change event from a
 *   field opens a gesture that closes when that field blurs, so a number
 *   field that writes on every keystroke, or a column name in the table
 *   editor, undoes as one edit.
 *
 * A gesture can't be left open: it also closes on the next press
 * anywhere, on pointercancel, when the window loses focus, and when the
 * region unmounts — and the store closes any open gesture before
 * undo/redo or when another gesture begins.
 */
export function useHistoryGestureScope() {
  const ownedRef = useRef<OwnedGesture | null>(null);

  const end = useCallback(() => {
    const owned = ownedRef.current;
    if (!owned) return;
    ownedRef.current = null;
    useEditorStore.getState().endHistoryGesture(owned.id);
  }, []);

  const begin = useCallback(
    (field: HTMLElement | null) => {
      end();
      ownedRef.current = { id: useEditorStore.getState().beginHistoryGesture(), field };
    },
    [end],
  );

  useEffect(() => {
    // Capture phase on the window: this runs before the press reaches any
    // region, so a stretch of typing is settled before the press can open
    // a gesture of its own.
    const onPointerDown = (event: PointerEvent) => {
      const field = ownedRef.current?.field;
      // Blur now rather than on the browser's default mousedown action, so
      // a field that commits on blur (titles, labels) commits as its own
      // step — not as part of the drag the press is about to start.
      if (field && globalThis.document.activeElement === field && !(event.target instanceof Node && field.contains(event.target))) field.blur();
      end();
    };
    const onPointerUp = () => {
      const owned = ownedRef.current;
      if (!owned || owned.field) return;
      window.setTimeout(() => {
        if (ownedRef.current === owned) end();
      }, 0);
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
    window.addEventListener('blur', end);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerUp, true);
      window.removeEventListener('blur', end);
      end();
    };
  }, [end]);

  return {
    onPointerDownCapture: () => begin(null),
    onChangeCapture: (event: FormEvent<HTMLElement>) => {
      const owned = ownedRef.current;
      // Already inside this region's gesture (a press, or this field's
      // typing) — the change just folds into it.
      if (owned && useEditorStore.getState().history.gesture?.id === owned.id) return;
      begin(event.target as HTMLElement);
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      if (ownedRef.current?.field === event.target) end();
    },
  };
}
