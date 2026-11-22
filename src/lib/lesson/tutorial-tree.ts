// The Lesson tree for the lessons converted from system-design-tutorials
// (spec 2026-11-22-lesson-tree-design.md §5.4): two roots, "System Design
// (EN)" and "(VI)", each holding the curriculum's chapters in order with
// their colours, each chapter its lessons (`tutorial-<lang>-<id>`, the ids
// the seed scripts write). Folder ids are fixed so re-seeding updates the
// same folders instead of adding new ones.

import { DEFAULT_FOLDER_COLOR, FOLDER_COLORS, emptyLessonTree, type FolderColor, type LessonTree } from './lesson-tree';

export interface CurriculumModule {
  id: string;
  num: string;
  title: string;
  color: string;
  lessons: { id: string; title: string }[];
}

const LANGUAGES = [
  { lang: 'en', root: 'System Design (EN)' },
  { lang: 'vi', root: 'System Design (VI)' },
] as const;

const colorOf = (color: string): FolderColor => ((FOLDER_COLORS as readonly string[]).includes(color) ? (color as FolderColor) : DEFAULT_FOLDER_COLOR);

/**
 * `viNames` maps an English chapter title to its Vietnamese one (the
 * tutorials' `i18n/vi.json`); `titles[lang]` maps a lesson id to the title
 * its converted Lesson carries.
 */
export function tutorialTree(curriculum: CurriculumModule[], viNames: Record<string, string>, titles: { en: Record<string, string>; vi: Record<string, string> }): LessonTree {
  const tree = emptyLessonTree();
  LANGUAGES.forEach(({ lang, root }, rootOrder) => {
    const rootId = `tutorial-${lang}`;
    tree.folders[rootId] = { parentId: null, name: root, color: DEFAULT_FOLDER_COLOR, order: rootOrder };
    curriculum.forEach((chapter, chapterOrder) => {
      const folderId = `tutorial-${lang}-${chapter.id}`;
      const name = lang === 'vi' && Object.hasOwn(viNames, chapter.title) ? viNames[chapter.title] : chapter.title;
      tree.folders[folderId] = { parentId: rootId, name, color: colorOf(chapter.color), order: chapterOrder };
      chapter.lessons.forEach((lesson, lessonOrder) => {
        const title = Object.hasOwn(titles[lang], lesson.id) ? titles[lang][lesson.id] : lesson.title;
        tree.lessons[`tutorial-${lang}-${lesson.id}`] = { folderId, order: lessonOrder, title, public: true };
      });
    });
  });
  return tree;
}

/** The seed's folders and entries overwrite their namesakes; everything else the user has is kept. */
export function mergeSeedTree(existing: LessonTree | null, seed: LessonTree): LessonTree {
  if (!existing) return seed;
  return {
    ...existing,
    folders: { ...existing.folders, ...seed.folders },
    lessons: { ...existing.lessons, ...seed.lessons },
  };
}
