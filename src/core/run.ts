// Headless core: owns every rule of a Run and never imports Phaser.
import { MINER_TUNING } from '../data/tuning';
import { generateLevel, roomContains, type Level, type Tile } from './level';
import { moveMiner, type Direction, type Miner } from './miner';

export type { Corridor, Level, Room, RoomKind, Tile } from './level';
export type { Direction, Miner } from './miner';

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
  /** Areas the Miner has entered; the rest of the Level stays dark. */
  readonly visited: VisitedAreas;
}

export interface Run {
  state(): RunState;
  update(input: RunInput, elapsedMs: number): void;
}

export function createRun(options: RunOptions): Run {
  const level = generateLevel(options.seed);
  let miner: Miner = { x: level.startGate.x + 0.5, y: level.startGate.y + 0.5, facing: 'down' };
  const visitedRooms: number[] = [];
  const visitedCorridors: number[] = [];

  const visitMinerArea = (): void => {
    const tile = { x: Math.floor(miner.x), y: Math.floor(miner.y) };
    const room = level.rooms.find((r) => roomContains(r, tile));
    if (room && !visitedRooms.includes(room.id)) visitedRooms.push(room.id);
    const corridor = level.corridors.find((c) => c.tiles.some((t) => sameTile(t, tile)));
    if (corridor && !visitedCorridors.includes(corridor.id)) visitedCorridors.push(corridor.id);
  };
  visitMinerArea();

  return {
    state: () => ({
      levelNumber: 1,
      score: 0,
      status: 'playing',
      level,
      miner,
      visited: { rooms: [...visitedRooms], corridors: [...visitedCorridors] },
    }),
    update(input, elapsedMs) {
      if (input.direction === null) return;
      miner = moveMiner(level, miner, input.direction, (MINER_TUNING.speed * elapsedMs) / 1000);
      visitMinerArea();
    },
  };
}

const sameTile = (a: Tile, b: Tile): boolean => a.x === b.x && a.y === b.y;
