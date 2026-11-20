import type { ReactNode } from 'react';
import type { ElementLook } from '@/lib/lesson/lesson-types';
import { LOOK_TRANSITION, lookStyle } from '@/lib/lesson/lesson-step-view';

/**
 * Wraps one canvas element in its lesson "look" (opacity + fade) and hover
 * hint. With neither `look` nor `hint` it renders `children` untouched, so
 * the Diagram editor, viewer and image export output stays as it was.
 */
export function LookGroup({ look, hint, children }: { look?: ElementLook; hint?: string; children: ReactNode }) {
  if (look === undefined && !hint) return <>{children}</>;
  return (
    <g
      style={{ ...lookStyle(look ?? 'normal'), transition: LOOK_TRANSITION }}
      // Body shapes set their own pointer-events attribute, which beats the
      // wrapper's inherited `none`; a stylesheet rule beats the attribute.
      className={look === 'gone' ? '[&_*]:pointer-events-none' : undefined}
    >
      {hint && <title>{hint}</title>}
      {children}
    </g>
  );
}
