'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { PANEL_DEFAULT_WIDTH, PANEL_MIN_WIDTH, PANEL_WIDTH_KEY, clampPanelWidth, parseStoredWidth } from '@/lib/panel-width';

const STEP = 16;
const BIG_STEP = 64;

function storedWidth(): number {
  if (typeof window === 'undefined') return PANEL_DEFAULT_WIDTH;
  try {
    return clampPanelWidth(parseStoredWidth(window.localStorage.getItem(PANEL_WIDTH_KEY)), window.innerWidth);
  } catch {
    return PANEL_DEFAULT_WIDTH;
  }
}

function remember(width: number) {
  try {
    window.localStorage.setItem(PANEL_WIDTH_KEY, String(width));
  } catch {
    // Storage blocked: the width lasts for this page only.
  }
}

/**
 * The Lesson editor's left panel, resizable from its right edge: drag the
 * handle, or focus it and use ← / → (⇧ for bigger steps), Home / End;
 * double-click resets. The width is clamped (`clampPanelWidth`) so the
 * canvas keeps most of the window, and remembered in this browser.
 */
export function ResizableAside({ children, label }: { children: ReactNode; label: string }) {
  const [width, setWidth] = useState(storedWidth);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; width: number } | null>(null);

  const resize = (next: number, save = true) => {
    const clamped = clampPanelWidth(next, window.innerWidth);
    setWidth(clamped);
    if (save) remember(clamped);
    return clamped;
  };

  // A narrower window takes the panel down with it (never below the minimum).
  useEffect(() => {
    const onResize = () => setWidth((current) => clampPanelWidth(current, window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, width };
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) resize(drag.current.width + event.clientX - drag.current.x, false);
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    remember(resize(drag.current.width + event.clientX - drag.current.x, false));
    drag.current = null;
    setDragging(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? BIG_STEP : STEP;
    // From the latest width, so presses that land before a re-render all count.
    const next = { ArrowLeft: (w: number) => w - step, ArrowRight: (w: number) => w + step, Home: () => PANEL_MIN_WIDTH, End: () => Number.MAX_SAFE_INTEGER }[event.key];
    if (!next) return;
    event.preventDefault();
    setWidth((current) => {
      const clamped = clampPanelWidth(next(current), window.innerWidth);
      remember(clamped);
      return clamped;
    });
  };

  const max = typeof window === 'undefined' ? PANEL_DEFAULT_WIDTH : clampPanelWidth(Number.MAX_SAFE_INTEGER, window.innerWidth);

  return (
    <aside className='relative shrink-0 border-r border-border' style={{ width }}>
      <div className='h-full overflow-y-auto'>{children}</div>
      <div
        role='separator'
        aria-orientation='vertical'
        aria-label={`Resize ${label}`}
        aria-valuemin={PANEL_MIN_WIDTH}
        aria-valuemax={max}
        aria-valuenow={width}
        tabIndex={0}
        title='Drag to resize · double-click to reset'
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onDoubleClick={() => resize(PANEL_DEFAULT_WIDTH)}
        onKeyDown={onKeyDown}
        className='group absolute inset-y-0 -right-1.5 z-20 w-3 cursor-col-resize touch-none outline-none'
      >
        <span className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors ${dragging ? 'bg-sky-400' : 'bg-transparent group-hover:bg-sky-400/60 group-focus-visible:bg-sky-400'}`} />
      </div>
      {/* While dragging, the pointer may cross the canvas or a text field: keep the resize cursor and no text selection everywhere. */}
      {dragging && <div aria-hidden='true' className='fixed inset-0 z-50 cursor-col-resize select-none' />}
    </aside>
  );
}
