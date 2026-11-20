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
    <g style={{ ...lookStyle(look ?? 'normal'), transition: LOOK_TRANSITION }}>
      {hint && <title>{hint}</title>}
      {children}
    </g>
  );
}
