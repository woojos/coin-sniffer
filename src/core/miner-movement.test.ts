import { describe, expect, it } from 'vitest';
import { MINER_TUNING } from '../data/tuning';
import { createRun, type Direction, type Level, type Run } from './run';
import { isFloor, minerTile, walkTo } from './testing/walk';

const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);
const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];
const VECTOR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] } as const;

/** The direction with the longest run of floor tiles straight out of the Miner's tile. */
function openDirection(run: Run): Direction {
  const level = run.state().level;
  const start = minerTile(run);
  const runLength = (d: Direction) => {
    let n = 0;
    while (isFloor(level, { x: start.x + VECTOR[d][0] * (n + 1), y: start.y + VECTOR[d][1] * (n + 1) })) n++;
    return n;
  };
  return [...DIRECTIONS].sort((a, b) => runLength(b) - runLength(a))[0]!;
}

function bodyOnFloor(level: Level, x: number, y: number): boolean {
  const half = MINER_TUNING.size / 2;
  for (const cx of [x - half + 1e-6, x + half - 1e-6]) {
    for (const cy of [y - half + 1e-6, y + half - 1e-6]) {
      if (!isFloor(level, { x: Math.floor(cx), y: Math.floor(cy) })) return false;
    }
  }
  return true;
}

describe('Miner movement', () => {
  it('starts on the start Gate', () => {
    const { miner, level } = createRun({ seed: 7 }).state();
    expect({ x: Math.floor(miner.x), y: Math.floor(miner.y) }).toEqual(level.startGate);
  });

  it('moves along one axis only, at a constant speed', () => {
    const run = createRun({ seed: 7 });
    const direction = openDirection(run);
    const p0 = run.state().miner;
    run.update({ direction }, 200);
    const p1 = run.state().miner;
    run.update({ direction }, 200);
    const p2 = run.state().miner;

    const [dx, dy] = VECTOR[direction];
    const step1 = (p1.x - p0.x) * dx + (p1.y - p0.y) * dy;
    const step2 = (p2.x - p1.x) * dx + (p2.y - p1.y) * dy;
    expect(step1).toBeGreaterThan(0);
    expect(step2).toBeCloseTo(step1, 9);
    if (dx === 0) expect(p2.x).toBe(p0.x);
    else expect(p2.y).toBe(p0.y);
  });

  it('stands still when no direction is held', () => {
    const run = createRun({ seed: 7 });
    const before = run.state().miner;
    run.update({ direction: null }, 500);
    expect(run.state().miner).toEqual(before);
  });

  it('is stopped by walls', () => {
    for (const seed of SEEDS) {
      const run = createRun({ seed });
      for (const direction of DIRECTIONS) {
        run.update({ direction }, 10_000);
        const { miner, level } = run.state();
        expect(bodyOnFloor(level, miner.x, miner.y)).toBe(true);
      }
    }
  });

  it('stays flush against a wall while walking along it', () => {
    for (const seed of SEEDS) {
      const run = createRun({ seed });
      run.update({ direction: 'left' }, 10_000);
      const flushX = run.state().miner.x;
      run.update({ direction: 'up' }, 50);
      run.update({ direction: 'down' }, 50);
      expect(run.state().miner.x).toBe(flushX);
    }
  });

  it('faces the last direction moved, and keeps facing it when stopped', () => {
    const run = createRun({ seed: 7 });
    run.update({ direction: 'left' }, 100);
    expect(run.state().miner.facing).toBe('left');
    run.update({ direction: 'up' }, 100);
    run.update({ direction: null }, 100);
    expect(run.state().miner.facing).toBe('up');
  });

  it('can walk from the start Gate to the end Gate without lining up exactly', () => {
    for (const seed of SEEDS) {
      const run = createRun({ seed });
      walkTo(run, run.state().level.endGate);
      expect(minerTile(run)).toEqual(run.state().level.endGate);
    }
  });
});
