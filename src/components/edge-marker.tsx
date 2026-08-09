'use client';

import * as React from 'react';
import type { EdgeMarker } from '@/lib/flowchart-types';

const FILL_BACK = '#18181b';
const STROKE_WIDTH = 2;
const STROKE_WIDTH_THIN = 1.5;

/**
 * SVG children for a line endpoint marker.
 *
 * The marker is drawn so its tip sits at the local origin (0,0), which
 * is the point returned by `buildEdgeGeometry` for the line endpoint.
 * The body of the marker extends to the left (negative x) so it sits
 * outside the target node and points along the line direction.
 */
export function EdgeMarkerSymbol({
  marker,
  className,
}: {
  marker: EdgeMarker;
  className?: string;
}) {
  const commonStroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: STROKE_WIDTH,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (marker) {
    case 'none':
      return null;
    case 'arrow':
      return (
        <path
          d="M 0 0 L -12 -5.5 L -12 5.5 Z"
          fill="currentColor"
          className={className}
        />
      );
    case 'open-arrow':
      return (
        <path
          d="M 0 0 L -12 -6 M 0 0 L -12 6"
          {...commonStroke}
          className={className}
        />
      );
    case 'triangle':
      return (
        <path
          d="M 0 0 L -12 -6 L -12 6 Z"
          fill={FILL_BACK}
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          strokeLinejoin="round"
          className={className}
        />
      );
    case 'circle':
      return (
        <circle
          cx={-6}
          cy={0}
          r={5}
          fill={FILL_BACK}
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          className={className}
        />
      );
    case 'diamond':
      return (
        <path
          d="M 0 0 L -7 -6 L -14 0 L -7 6 Z"
          fill={FILL_BACK}
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          strokeLinejoin="round"
          className={className}
        />
      );
    case 'tee':
      return <path d="M -6 -6 V 6 M -6 0 H 0" {...commonStroke} className={className} />;
    case 'cross':
      return <path d="M -6 -6 H 0 V 6 H -6" {...commonStroke} className={className} />;
    case 'circle-cross':
      return (
        <>
          <circle
            cx={-6}
            cy={0}
            r={5}
            fill={FILL_BACK}
            stroke="currentColor"
            strokeWidth={STROKE_WIDTH}
            className={className}
          />
          <path
            d="M -6 -3 V 3 M -9 0 H -3"
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE_WIDTH_THIN}
            strokeLinecap="round"
            className={className}
          />
        </>
      );
    case 'arrow-both':
      return (
        <>
          <path d="M 0 0 L -10 -5 M 0 0 L -10 5" {...commonStroke} className={className} />
          <path d="M -12 -5 L -22 0 L -12 5" {...commonStroke} className={className} />
        </>
      );
    case 'arrow-bar':
      return (
        <>
          <path d="M -12 -5 V 5" {...commonStroke} className={className} />
          <path d="M -4 0 L -12 -5 M -4 0 L -12 5" {...commonStroke} className={className} />
        </>
      );
    case 'bar':
      return <path d="M -4 -7 V 7" {...commonStroke} className={className} />;

    // --- Crow's foot (IE) cardinality -------------------------------
    // The foot fans out towards the table it touches (x = 0) and the
    // optionality symbols stack further back along the line, so the
    // pair reads in the usual order: [zero/one] then [one/many].
    case 'crow-many':
      return <path d="M -12 0 L 0 -6 M -12 0 L 0 0 M -12 0 L 0 6" {...commonStroke} className={className} />;
    case 'crow-one':
      return <path d="M -8 -6 V 6" {...commonStroke} className={className} />;
    case 'crow-one-many':
      return (
        <>
          <path d="M -17 -6 V 6" {...commonStroke} className={className} />
          <path d="M -12 0 L 0 -6 M -12 0 L 0 0 M -12 0 L 0 6" {...commonStroke} className={className} />
        </>
      );
    case 'crow-zero-one':
      return (
        <>
          <circle cx={-17} cy={0} r={4.5} fill={FILL_BACK} stroke="currentColor" strokeWidth={STROKE_WIDTH_THIN} className={className} />
          <path d="M -8 -6 V 6" {...commonStroke} className={className} />
        </>
      );
    case 'crow-zero-many':
      return (
        <>
          <circle cx={-18} cy={0} r={4.5} fill={FILL_BACK} stroke="currentColor" strokeWidth={STROKE_WIDTH_THIN} className={className} />
          <path d="M -12 0 L 0 -6 M -12 0 L 0 0 M -12 0 L 0 6" {...commonStroke} className={className} />
        </>
      );
  }
}
