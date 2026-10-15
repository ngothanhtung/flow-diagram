import { describe, expect, it } from 'vitest';
import { colorFieldCommit, numberFieldCommitValue, numberFieldLiveValue } from './fields';

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

describe('numberFieldLiveValue', () => {
  // Regression: every keystroke used to be written straight through, so
  // typing "210" over a 72 minimum wrote 2 → clamped to 72 → echoed back
  // into the box, and the next keys landed on "72" (ending at e.g. 7210).
  it('writes nothing while the typed number is still out of range', () => {
    expect(numberFieldLiveValue('2', 72, 320)).toBeNull();
    expect(numberFieldLiveValue('21', 72, 320)).toBeNull();
    expect(numberFieldLiveValue('2100', 72, 320)).toBeNull();
  });

  it('writes the number as soon as it is in range', () => {
    expect(numberFieldLiveValue('210', 72, 320)).toBe(210);
    expect(numberFieldLiveValue('-40', undefined, undefined)).toBe(-40);
    expect(numberFieldLiveValue('1.5', 0.5, 16)).toBe(1.5);
  });

  it('writes nothing for an empty or half-typed box', () => {
    expect(numberFieldLiveValue('', 0, 10)).toBeNull();
    expect(numberFieldLiveValue('-', undefined, undefined)).toBeNull();
  });
});

describe('numberFieldCommitValue', () => {
  it('clamps an out-of-range number into range on commit', () => {
    expect(numberFieldCommitValue('2', 72, 320)).toBe(72);
    expect(numberFieldCommitValue('9999', 72, 320)).toBe(320);
    expect(numberFieldCommitValue('150', 72, 320)).toBe(150);
  });

  it('commits nothing for an empty or unparseable box, so it reverts', () => {
    expect(numberFieldCommitValue('', 72, 320)).toBeNull();
    expect(numberFieldCommitValue('-', 72, 320)).toBeNull();
  });
});
