// Headless core: owns every rule of a Run and never imports Phaser.
import { MINER_TUNING, MONSTER_TUNING, SWORD, type Weapon } from '../data/tuning';
import { touchesCoin, type Coin } from './coins';
import { areaAt, generateLevel, type Level } from './level';
import { hitMonster, touchesMiner, updateMonster, type Monster } from './monsters';
import { moveMiner, type Direction, type Miner } from './miner';
import { createRandom } from './random';
import { inSwingArc } from './swing';
import { tileKey, type Tile } from './tile';

export type { Corridor, Level, Rect, Room, RoomKind } from './level';
export type { Tile } from './tile';
export type { Coin } from './coins';
export type { Monster, MonsterKind } from './monsters';
export type { Direction, Miner } from './miner';
export type { Denomination, Weapon } from '../data/tuning';

export type RunStatus = 'playing' | 'paused' | 'over';

export interface RunOptions {
  /** Seed for the first Level and for every Level after it, so a Run can be reproduced exactly. */
  seed: number;
  /** False spawns no Monsters, so walking, Coins and Levels can be exercised on their own. Defaults to true. */
  monsters?: boolean;
}

export interface RunInput {
  /** The one direction the Miner is told to walk, or null to stand still. */
  readonly direction: Direction | null;
  /** Whether the Swing key is held. Only a fresh press starts a Swing; holding it does not repeat. */
  readonly swing?: boolean;
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
  /** The Miner's remaining Life; it never refills and the Run ends when it reaches zero. */
  readonly life: number;
  /** Time left in the Miner's invulnerability window after a hit; 0 when he can be hurt. */
  readonly invulnerableMs: number;
  /** The Weapon the Miner fights with. */
  readonly weapon: Weapon;
  /** The Swing in progress, until its hit lands; null when the Miner is not swinging. */
  readonly swing: SwingState | null;
  /** Coins not yet collected. */
  readonly coins: readonly Coin[];
  /** Monsters on the current Level, where they stand now. */
  readonly monsters: readonly Monster[];
  /** Areas the Miner has entered; the rest of the Level stays dark. */
  readonly visited: VisitedAreas;
}

export interface SwingState {
  /** The facing the Swing started with; it keeps it even if the Miner turns. */
  readonly facing: Direction;
  /** How far the Swing is towards its hit landing, from 0 to 1. */
  readonly progress: number;
}

export interface Run {
  state(): RunState;
  update(input: RunInput, elapsedMs: number): void;
}

/** Mixed into the Run's seed for the stream that seeds later Levels, so it differs from Level 1's own stream. */
const LEVEL_SEED_SALT = 0x9e3779b9;

/**
 * Longest slice of time simulated at once. The Miner moves at most a tenth of a tile in it,
 * so fast frames cannot skip a Coin, a Monster or a Gate.
 */
const STEP_MS = (0.1 / MINER_TUNING.speed) * 1000;

export function createRun(options: RunOptions): Run {
  const levelSeeds = createRandom(options.seed ^ LEVEL_SEED_SALT);
  let levelNumber = 1;
  let level!: Level;
  let miner!: Miner;
  let coins: readonly Coin[] = [];
  let monsters: readonly Monster[] = [];
  let score = 0;
  let life: number = MINER_TUNING.life;
  let invulnerableMs = 0;
  const weapon = SWORD;
  /** Whether the Swing key was held at the last update, so holding it does not repeat. */
  let swingHeld = false;
  let swingElapsedMs: number | null = null;
  let swingFacing: Direction = 'down';
  let swingCooldownMs = 0;
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
    monsters = options.monsters === false ? [] : level.monsters;
    swingElapsedMs = null;
    visitedRooms = [];
    visitedCorridors = [];
    visitMinerArea();
  };

  /** Lands the Swing on every Monster inside its arc; defeated Monsters are gone for good. */
  const landSwing = (): void => {
    monsters = monsters
      .map((m) => (inSwingArc({ ...miner, facing: swingFacing }, weapon, m) ? hitMonster(m, weapon.attackStrength) : m))
      .filter((m) => m.life > 0);
  };

  /** A touching Monster deals its damage, unless the Miner is still invulnerable from the last hit. */
  const takeContactDamage = (): void => {
    if (invulnerableMs > 0) return;
    const attacker = monsters.find((m) => touchesMiner(m, miner));
    if (!attacker) return;
    life = Math.max(0, life - MONSTER_TUNING[attacker.kind].damage);
    invulnerableMs = MINER_TUNING.invulnerabilityMs;
  };

  const descend = (): void => {
    levelNumber += 1;
    enterLevel(levelSeeds.int(0, 2 ** 32 - 1), miner.facing);
  };

  /**
   * Simulates one short slice of time and returns whether the update should go on. A descent
   * stops it, so the new Level starts still; so does death, which ends the Run.
   */
  const step = (direction: Direction | null, ms: number): boolean => {
    invulnerableMs = Math.max(0, invulnerableMs - ms);
    swingCooldownMs = Math.max(0, swingCooldownMs - ms);
    if (direction !== null) {
      miner = moveMiner(level, miner, direction, (MINER_TUNING.speed * ms) / 1000);
      collectTouchedCoins();
      visitMinerArea();
      if (onTile(miner, level.endGate)) {
        descend();
        return false;
      }
    }
    monsters = monsters.map((m) => updateMonster(m, level.rooms[m.room]!, miner, ms));
    if (swingElapsedMs !== null) {
      swingElapsedMs += ms;
      if (swingElapsedMs >= weapon.swingTimeMs) {
        landSwing();
        swingElapsedMs = null;
      }
    }
    takeContactDamage();
    return life > 0;
  };

  enterLevel(options.seed, 'down');

  return {
    state: () => ({
      levelNumber,
      score,
      status: life > 0 ? 'playing' : 'over',
      level,
      miner,
      life,
      invulnerableMs,
      weapon,
      swing:
        swingElapsedMs === null
          ? null
          : { facing: swingFacing, progress: Math.min(1, swingElapsedMs / weapon.swingTimeMs) },
      coins,
      monsters,
      visited: { rooms: [...visitedRooms], corridors: [...visitedCorridors] },
    }),
    update(input, elapsedMs) {
      if (life === 0) return;
      const pressed = input.swing === true && !swingHeld;
      swingHeld = input.swing === true;
      if (pressed && swingElapsedMs === null && swingCooldownMs === 0) {
        swingElapsedMs = 0;
        swingFacing = miner.facing;
        swingCooldownMs = weapon.cooldownMs;
      }
      const steps = Math.max(1, Math.ceil(elapsedMs / STEP_MS));
      for (let i = 0; i < steps; i++) {
        if (!step(input.direction, elapsedMs / steps)) return;
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
