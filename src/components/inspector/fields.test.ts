import { describe, expect, it } from 'vitest';
import { colorFieldCommit } from './fields';

describe('colorFieldCommit', () => {
  // Regression: blurring the hex box of an unset colour (which shows the
  // resolved default, e.g. #FFFFFF) used to commit that default as an
  // explicit colour — a real document change and an undo step that
  // visibly did nothing, which also left the diagram "unsaved".
  it('commits nothing when the box still holds the colour the field shows', () => {
    expect(colorFieldCommit('#ffffff', '#ffffff')).toBeNull();
    expect(colorFieldCommit('#FFFFFF', '#ffffff')).toBeNull();
  });

  it('commits a changed colour, normalised to a full hex', () => {
    expect(colorFieldCommit('#abc', '#ffffff')).toBe('#aabbcc');
    expect(colorFieldCommit('123456', '#ffffff')).toBe('#123456');
  });

  it('commits nothing for text that is not a colour', () => {
    expect(colorFieldCommit('blue', '#ffffff')).toBeNull();
  });
});
