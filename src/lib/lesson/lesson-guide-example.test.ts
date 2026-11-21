import { describe, expect, it } from 'vitest';
import { LESSON_GUIDE_EXAMPLE } from './lesson-guide-example';
import { normalizeLessonDocument } from './lesson-normalize';

describe('the /guide/lessons worked example', () => {
  it('passes the normalizer with no fix', () => {
    const result = normalizeLessonDocument(JSON.parse(JSON.stringify(LESSON_GUIDE_EXAMPLE)));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.fixes).toEqual([]);
  });

  it('has three Lesson steps and brings GraphQL in at the third', () => {
    expect(LESSON_GUIDE_EXAMPLE.steps.map((step) => step.id)).toEqual(['s1', 's2', 's3']);
    expect(LESSON_GUIDE_EXAMPLE.presence.graphql).toEqual({ from: 's3' });
  });
});
