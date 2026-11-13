// Headless game core: owns every game rule and never imports Phaser.

export type RunStatus = 'playing' | 'paused' | 'over';

export interface RunOptions {
  /** Seed for Level generation, so a Run can be reproduced exactly. */
  seed: number;
}

export interface RunState {
  level: number;
  score: number;
  status: RunStatus;
}

export interface Run {
  state(): RunState;
}

export function createRun(_options: RunOptions): Run {
  const state: RunState = { level: 1, score: 0, status: 'playing' };
  return {
    state: () => ({ ...state }),
  };
}
