import { describe, expect, it } from 'vitest';
import { MONSTER_TUNING, SWORD } from '../data/tuning';
import { createRun, type Direction, type Monster, type Run } from './run';
import { walkTo } from './testing/walk';

const OPPOSITE: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** The Room after the start Room on the Main Path, and its Crawlers as they are now. */
function nextRoom(run: Run) {
  const { level, monsters } = run.state();
  const room = level.rooms[level.mainPath[1]!]!;
  return { room, crawlers: monsters.filter((m) => m.room === room.id) };
}

const still = (run: Run, ms: number, swing = false) => {
  for (let t = 0; t < ms; t += 10) run.update({ direction: null, swing }, 10);
};

/** These Monsters as they are now; defeated ones are left out. */
const now = (run: Run, monsters: readonly Monster[]) =>
  run.state().monsters.filter((m) => monsters.some((o) => o.id === m.id));

/**
 * Walks to the middle of the Room after the start Room and waits until every Crawler that
 * woke up stands on the Miner, so they all sit in one spot. Returns them.
 */
function gatherCrawlers(run: Run): Monster[] {
  const { room } = nextRoom(run);
  walkTo(run, { x: room.x + Math.floor(room.width / 2), y: room.y + Math.floor(room.height / 2) });
  for (let i = 0; i < 400; i++) {
    const awake = nextRoom(run).crawlers.filter((m) => m.awake);
    if (awake.length > 0 && awake.every((m) => distance(m, run.state().miner) < 0.01)) return awake;
    run.update({ direction: null }, 10);
  }
  throw new Error('Crawlers never gathered on the Miner');
}

/**
 * Gathers the Crawlers, then walks the Miner straight away from them for `awayMs` so they
 * trail directly behind him, and optionally turns him round on the spot to face them.
 */
function lineUp(run: Run, awayMs: number, turn: boolean): Monster[] {
  const gathered = gatherCrawlers(run);
  const { room } = nextRoom(run);
  const { miner } = run.state();
  const away: Direction = miner.x < room.x + room.width / 2 ? 'right' : 'left';
  for (let t = 0; t < awayMs; t += 10) run.update({ direction: away }, 10);
  if (turn) run.update({ direction: OPPOSITE[away] }, 1);
  return now(run, gathered);
}

describe('Swing hits', () => {
  it('hits a Crawler in front within reach, but only after the swing time', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const run = createRun({ seed });
      const before = lineUp(run, 300, true);
      expect(before.every((m) => m.life === MONSTER_TUNING.crawler.life && m.flashMs === 0)).toBe(true);

      run.update({ direction: null, swing: true }, 1);
      expect(now(run, before).map((m) => m.life)).toEqual(before.map((m) => m.life));
      still(run, SWORD.swingTimeMs, true);

      const after = now(run, before);
      expect(after.map((m) => m.life)).toEqual(before.map((m) => m.life - SWORD.attackStrength));
      expect(after.every((m) => m.flashMs > 0)).toBe(true);
    }
  });

  it('misses Crawlers behind the Miner', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const run = createRun({ seed });
      const before = lineUp(run, 300, false);
      expect(before.every((m) => distance(m, run.state().miner) < SWORD.reach)).toBe(true);

      run.update({ direction: null, swing: true }, 1);
      still(run, SWORD.swingTimeMs * 2, true);
      expect(now(run, before).map((m) => m.life)).toEqual(before.map((m) => m.life));
    }
  });

  it('misses Crawlers in front but beyond reach', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const run = createRun({ seed });
      const before = lineUp(run, 900, true);
      expect(before.every((m) => distance(m, run.state().miner) > SWORD.reach + 0.5)).toBe(true);

      run.update({ direction: null, swing: true }, 1);
      still(run, SWORD.swingTimeMs * 2, true);
      expect(now(run, before).map((m) => m.life)).toEqual(before.map((m) => m.life));
    }
  });

  it('misses Crawlers within reach but off to the side of the arc', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const run = createRun({ seed });
      const before = lineUp(run, 300, true);
      run.update({ direction: 'up' }, 1);

      run.update({ direction: null, swing: true }, 1);
      still(run, SWORD.swingTimeMs * 2, true);
      expect(now(run, before).map((m) => m.life)).toEqual(before.map((m) => m.life));
    }
  });

  it('keeps the facing it started with, even if the Miner turns before the hit lands', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const run = createRun({ seed });
      const before = lineUp(run, 300, true);
      const facing = run.state().miner.facing;

      run.update({ direction: null, swing: true }, 1);
      run.update({ direction: OPPOSITE[facing], swing: true }, 1);
      still(run, SWORD.swingTimeMs, true);
      expect(now(run, before).map((m) => m.life)).toEqual(before.map((m) => m.life - SWORD.attackStrength));
    }
  });

  it('hits every Crawler inside the arc at once', () => {
    const seed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find((s) => lineUp(createRun({ seed: s }), 300, true).length >= 2);
    expect(seed).toBeDefined();
    const run = createRun({ seed: seed! });
    const before = lineUp(run, 300, true);

    run.update({ direction: null, swing: true }, 1);
    still(run, SWORD.swingTimeMs, true);
    expect(now(run, before).map((m) => m.life)).toEqual(before.map((m) => m.life - SWORD.attackStrength));
  });
});

/** Total Life the given Monsters have lost since `before`. */
const lifeLost = (run: Run, before: readonly Monster[]) =>
  before.reduce((sum, m) => sum + m.life - (now(run, [m])[0]?.life ?? 0), 0);

describe('Swing timing', () => {
  it('does not repeat while the Swing key is held; a fresh press swings again', () => {
    const run = createRun({ seed: 1 });
    const [crawler] = gatherCrawlers(run);
    const before = [crawler!];

    run.update({ direction: null, swing: true }, 1);
    still(run, SWORD.cooldownMs * 3, true);
    expect(lifeLost(run, before)).toBe(SWORD.attackStrength);

    still(run, 10, false);
    run.update({ direction: null, swing: true }, 1);
    still(run, SWORD.swingTimeMs, true);
    expect(lifeLost(run, before)).toBe(SWORD.attackStrength * 2);
  });

  it('ignores a fresh press during the cooldown', () => {
    const run = createRun({ seed: 1 });
    const [crawler] = gatherCrawlers(run);
    const before = [crawler!];

    run.update({ direction: null, swing: true }, 1);
    still(run, SWORD.swingTimeMs, false);
    run.update({ direction: null, swing: true }, 1);
    still(run, SWORD.cooldownMs - SWORD.swingTimeMs - 20, false);
    expect(lifeLost(run, before)).toBe(SWORD.attackStrength);

    still(run, 40, false);
    run.update({ direction: null, swing: true }, 1);
    still(run, SWORD.swingTimeMs, false);
    expect(lifeLost(run, before)).toBe(SWORD.attackStrength * 2);
  });
});

describe('Defeat', () => {
  it('removes a Crawler when its Life runs out, drops nothing, and it never comes back on the Level', () => {
    const run = createRun({ seed: 1 });
    const gathered = gatherCrawlers(run);
    const total = run.state().monsters.length;
    const coins = run.state().coins;
    const swingsToDefeat = Math.ceil(MONSTER_TUNING.crawler.life / SWORD.attackStrength);

    for (let i = 0; i < swingsToDefeat; i++) {
      expect(now(run, gathered)).toHaveLength(gathered.length);
      run.update({ direction: null, swing: true }, 1);
      still(run, SWORD.cooldownMs, false);
    }

    expect(now(run, gathered)).toEqual([]);
    expect(run.state().monsters).toHaveLength(total - gathered.length);
    expect(run.state().coins).toEqual(coins);

    const level = run.state().level;
    still(run, 3000, false);
    expect(run.state().level).toBe(level);
    expect(run.state().monsters).toHaveLength(total - gathered.length);
  });
});
