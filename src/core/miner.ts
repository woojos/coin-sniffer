import { MINER_TUNING } from '../data/tuning';
import type { Level } from './level';

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Miner {
  /** Centre of the Miner's body, in tiles. */
  readonly x: number;
  readonly y: number;
  readonly facing: Direction;
}

const VECTOR: Record<Direction, { readonly dx: number; readonly dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/** Largest distance moved before re-checking walls, so the Miner never skips through one. */
const SUBSTEP = 0.05;
const EPSILON = 1e-9;

/**
 * Moves the Miner `distance` tiles in one of four directions. Walls stop him flush. When he
 * is blocked but the lane he is centred in is open ahead (a Corridor mouth he is slightly
 * off), he slides sideways towards that lane's centre instead, so narrow Corridors are easy
 * to enter.
 */
export function moveMiner(level: Level, miner: Miner, direction: Direction, distance: number): Miner {
  const { dx, dy } = VECTOR[direction];
  const half = MINER_TUNING.size / 2;
  let { x, y } = miner;

  for (let remaining = distance; remaining > EPSILON; ) {
    const step = Math.min(remaining, SUBSTEP);
    remaining -= step;
    if (bodyFits(level, x + dx * step, y + dy * step, half)) {
      x += dx * step;
      y += dy * step;
      continue;
    }

    // Measured along the direction of travel ("along") and sideways to it ("across").
    const along = dx !== 0 ? x : y;
    const across = dx !== 0 ? y : x;
    const sign = dx + dy;
    const lane = Math.floor(across) + 0.5;
    const nextColumn = Math.floor(along + sign * (half + step));
    const laneOpen = dx !== 0 ? isFloor(level, nextColumn, Math.floor(y)) : isFloor(level, Math.floor(x), nextColumn);

    if (laneOpen && Math.abs(across - lane) > EPSILON) {
      const shift = Math.sign(lane - across) * Math.min(step, Math.abs(lane - across));
      if (dx !== 0) y += shift;
      else x += shift;
      continue;
    }

    const flush = sign > 0 ? nextColumn - half : nextColumn + 1 + half;
    const settled = sign > 0 ? Math.max(along, flush) : Math.min(along, flush);
    if (dx !== 0) x = settled;
    else y = settled;
    break;
  }

  return { x, y, facing: direction };
}

function bodyFits(level: Level, x: number, y: number, half: number): boolean {
  // Edges that only touch a wall do not overlap it, despite floating-point error either way.
  for (let ty = Math.floor(y - half + EPSILON); ty <= Math.floor(y + half - EPSILON); ty++) {
    for (let tx = Math.floor(x - half + EPSILON); tx <= Math.floor(x + half - EPSILON); tx++) {
      if (!isFloor(level, tx, ty)) return false;
    }
  }
  return true;
}

function isFloor(level: Level, x: number, y: number): boolean {
  return level.floor[y]?.[x] === true;
}
