import { describe, expect, it } from 'vitest';
import { createRun } from './run';

describe('a new Run', () => {
  it('starts on Level 1 with a Score of 0 and is playing', () => {
    const run = createRun({ seed: 1 });

    expect(run.state()).toEqual({ level: 1, score: 0, status: 'playing' });
  });
});
