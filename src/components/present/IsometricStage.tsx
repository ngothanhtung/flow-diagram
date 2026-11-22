import type { ReactNode } from 'react';

/**
 * Isometric view (a spike): the canvas laid flat on a square "floor", turned
 * 45° and tilted back — the isometric angle. The floor is square so the
 * diamond it becomes fits the screen; the canvas fits the Diagram into it as
 * usual. A look only: the Diagram, its run and its layout are untouched.
 */
export const ISOMETRIC_TRANSFORM = 'scale(1.3) rotateX(55deg) rotateZ(-45deg)';

export function IsometricStage({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  if (!enabled) {
    return (
      <div data-isometric='false' className='h-full w-full'>
        {children}
      </div>
    );
  }
  return (
    <div data-isometric='true' className='grid h-full w-full place-items-center overflow-hidden'>
      <div
        className='aspect-square h-full max-w-full'
        style={{ transform: ISOMETRIC_TRANSFORM, transformOrigin: '50% 50%' }}
      >
        {children}
      </div>
    </div>
  );
}
