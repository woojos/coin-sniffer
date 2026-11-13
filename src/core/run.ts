// Headless core: owns every rule of a Run and never imports Phaser.
import { MINER_TUNING } from '../data/tuning';
import { touchesCoin, type Coin } from './coins';
import { areaAt, generateLevel, type Level } from './level';
import { moveMiner, type Direction, type Miner } from './miner';
import { createRandom } from './random';
import { tileKey, type Tile } from './tile';

export type { Corridor, Level, Rect, Room, RoomKind } from './level';
export type { Tile } from './tile';
export type { Coin } from './coins';
export type { Direction, Miner } from './miner';
export type { Denomination } from '../data/tuning';

export type RunStatus = 'playing' | 'paused' | 'over';

export interface RunOptions {
  /** Seed for the first Level and for every Level after it, so a Run can be reproduced exactly. */
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

/** Mixed into the Run's seed for the stream that seeds later Levels, so it differs from Level 1's own stream. */
const LEVEL_SEED_SALT = 0x9e3779b9;

/** Longest stretch the Miner moves between Coin checks, so fast frames cannot skip a Coin. */
const COLLECTION_STEP = 0.1;

export function createRun(options: RunOptions): Run {
  const levelSeeds = createRandom(options.seed ^ LEVEL_SEED_SALT);
  let levelNumber = 1;
  let level!: Level;
  let miner!: Miner;
  let coins: readonly Coin[] = [];
  let score = 0;
  let visitedRooms: number[] = [];
  let visitedCorridors: number[] = [];

  const visitMinerArea = (): void => {
    const area = areaAt(level, minerTile(miner));
    const visited = area?.kind === 'room' ? visitedRooms : visitedCorridors;
    if (area && !visited.includes(area.id)) visited.push(area.id);
  };

  const collectTouchedCoins = (): void => {
    const touched = coins.filter((coin) => touchesCoin(miner, coin));
    if (touched.length === 0) return;
    score += touched.reduce((sum, coin) => sum + coin.denomination, 0);
    coins = coins.filter((coin) => !touched.includes(coin));
  };

  /** A fresh Level replaces the old one entirely, so there is no way back. */
  const enterLevel = (seed: number, facing: Direction): void => {
    level = generateLevel(seed, levelNumber);
    miner = { x: level.startGate.x + 0.5, y: level.startGate.y + 0.5, facing };
    coins = level.coins;
    visitedRooms = [];
    visitedCorridors = [];
    visitMinerArea();
  };

  const descend = (): void => {
    levelNumber += 1;
    enterLevel(levelSeeds.int(0, 2 ** 32 - 1), miner.facing);
  };

  enterLevel(options.seed, 'down');

  return {
    state: () => ({
      levelNumber,
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
        if (onTile(miner, level.endGate)) {
          descend();
          return;
        }
      }
    },
  };
}

function minerTile(miner: Miner): Tile {
  return { x: Math.floor(miner.x), y: Math.floor(miner.y) };
}

function onTile(miner: Miner, tile: Tile): boolean {
  return tileKey(minerTile(miner)) === tileKey(tile);
}
