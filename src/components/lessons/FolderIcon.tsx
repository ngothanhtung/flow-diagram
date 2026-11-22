import { FOLDER_PAINT, type FolderColor } from '@/lib/lesson/lesson-tree';

/** A Lesson folder glyph in its colour — the folder shape system-design-tutorials draws. */
export function FolderIcon({ color, size = 16, className }: { color: FolderColor; size?: number; className?: string }) {
  const paint = FOLDER_PAINT[color] ?? FOLDER_PAINT.slate;
  return (
    <svg width={size * 1.25} height={size} viewBox='0 0 20 16' aria-hidden='true' className={className}>
      <path d='M1.2 3.2A2 2 0 0 1 3.2 1.2h4.1l2 2.2h7.5a2 2 0 0 1 2 2v8.4a2 2 0 0 1-2 2H3.2a2 2 0 0 1-2-2Z' fill={paint.fill} stroke={paint.stroke} strokeWidth={1.2} strokeLinejoin='round' />
      <path d='M1.2 6.2h17.6' stroke={paint.stroke} strokeWidth={1.2} fill='none' />
    </svg>
  );
}
