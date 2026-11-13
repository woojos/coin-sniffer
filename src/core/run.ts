// Headless core: owns every rule of a Run and never imports Phaser.
import { MINER_TUNING } from '../data/tuning';
import { touchesCoin, type Coin } from './coins';
import { areaAt, generateLevel, type Level } from './level';
import { moveMiner, type Direction, type Miner } from './miner';

export type { Corridor, Level, Rect, Room, RoomKind, Tile } from './level';
export type { Coin } from './coins';
export type { Direction, Miner } from './miner';
export type { Denomination } from '../data/tuning';

export type RunStatus = 'playing' | 'paused' | 'over';

export interface RunOptions {
  /** Seed for Level generation, so a Run can be reproduced exactly. */
  seed: number;
}

export interface RunInput {
  /** The one direction the Miner is told to walk, or null to stand still. */
  readonly direction: Direction | null;
}

export interface VisitedAreas {
  /** Room ids in the order the Miner first entered them. */
  readonly rooms: readonly number[];
  /** Corridor ids in the order the Miner first entered them. */
  readonly corridors: readonly number[];
}

export interface RunState {
  readonly levelNumber: number;
  readonly score: number;
  readonly status: RunStatus;
  readonly level: Level;
  readonly miner: Miner;
  /** Coins not yet collected. */
  readonly coins: readonly Coin[];
  /** Areas the Miner has entered; the rest of the Level stays dark. */
  readonly visited: VisitedAreas;
}

export interface Run {
  state(): RunState;
  update(input: RunInput, elapsedMs: number): void;
}

/** Longest stretch the Miner moves between Coin checks, so fast frames cannot skip a Coin. */
const COLLECTION_STEP = 0.1;

export function createRun(options: RunOptions): Run {
  const level = generateLevel(options.seed);
  let miner: Miner = { x: level.startGate.x + 0.5, y: level.startGate.y + 0.5, facing: 'down' };
  let coins: readonly Coin[] = level.coins;
  let score = 0;
  const visitedRooms: number[] = [];
  const visitedCorridors: number[] = [];

  const visitMinerArea = (): void => {
    const area = areaAt(level, { x: Math.floor(miner.x), y: Math.floor(miner.y) });
    const visited = area?.kind === 'room' ? visitedRooms : visitedCorridors;
    if (area && !visited.includes(area.id)) visited.push(area.id);
  };

  const collectTouchedCoins = (): void => {
    const half = MINER_TUNING.size / 2;
    const touched = coins.filter((coin) => touchesCoin(miner.x, miner.y, half, coin));
    if (touched.length === 0) return;
    score += touched.reduce((sum, coin) => sum + coin.denomination, 0);
    coins = coins.filter((coin) => !touched.includes(coin));
  };

  visitMinerArea();

  return {
    state: () => ({
      levelNumber: 1,
      score,
      status: 'playing',
      level,
      miner,
      coins,
      visited: { rooms: [...visitedRooms], corridors: [...visitedCorridors] },
    }),
    update(input, elapsedMs) {
      const { direction } = input;
      if (direction === null) return;
      const distance = (MINER_TUNING.speed * elapsedMs) / 1000;
      const steps = Math.max(1, Math.ceil(distance / COLLECTION_STEP));
      for (let i = 0; i < steps; i++) {
        miner = moveMiner(level, miner, direction, distance / steps);
        collectTouchedCoins();
        visitMinerArea();
      }
    },
  };
}
