import { describe, expect, it } from 'vitest';
import { createRun } from './run';

describe('a new Run', () => {
  it('starts on Level 1 with a Score of 0 and is playing', () => {
    const state = createRun({ seed: 1 }).state();

    expect(state.levelNumber).toBe(1);
    expect(state.score).toBe(0);
    expect(state.status).toBe('playing');
  });
});
