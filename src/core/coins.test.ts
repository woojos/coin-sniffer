import { describe, expect, it } from 'vitest';
import { createRun, type Coin, type Level, type Run } from './run';
import { key, walkTo } from './testing/walk';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
const DENOMINATIONS = [1, 5, 10, 25, 100];

const inRoom = (level: Level, coin: Coin) =>
  level.rooms.find(
    (r) => coin.x >= r.x && coin.x < r.x + r.width && coin.y >= r.y && coin.y < r.y + r.height,
  );
const inCorridor = (level: Level, coin: Coin) =>
  level.corridors.find((c) => c.tiles.some((t) => t.x === coin.x && t.y === coin.y));

describe('Coin placement', () => {
  it('lays Coins on floor tiles of Rooms and Corridors, at most one per tile and never on a Gate', () => {
    let corridorCoins = 0;
    for (const seed of SEEDS) {
      const { level, coins } = createRun({ seed }).state();
      expect(coins.length).toBeGreaterThan(0);
      expect(new Set(coins.map(key)).size).toBe(coins.length);
      for (const coin of coins) {
        expect(level.floor[coin.y]?.[coin.x]).toBe(true);
        expect(inRoom(level, coin) ?? inCorridor(level, coin)).toBeDefined();
        expect(key(coin)).not.toBe(key(level.startGate));
        expect(key(coin)).not.toBe(key(level.endGate));
      }
      corridorCoins += coins.filter((c) => inCorridor(level, c)).length;
    }
    expect(corridorCoins).toBeGreaterThan(0);
  });

  it('puts Coins in every Room, in proportion to its area', () => {
    const totals = { small: { coins: 0, area: 0 }, large: { coins: 0, area: 0 } };
    for (const seed of SEEDS) {
      const { level, coins } = createRun({ seed }).state();
      for (const room of level.rooms.filter((r) => r.kind === 'main')) {
        const count = coins.filter((c) => inRoom(level, c)?.id === room.id).length;
        expect(count).toBeGreaterThan(0);
        const bucket = room.width * room.height < 120 ? totals.small : totals.large;
        bucket.coins += count;
        bucket.area += room.width * room.height;
      }
    }
    const small = totals.small.coins / totals.small.area;
    const large = totals.large.coins / totals.large.area;
    expect(large / small).toBeGreaterThan(0.8);
    expect(large / small).toBeLessThan(1.25);
  });

  it('makes Side Rooms richer per tile than Main Path Rooms', () => {
    const totals = { main: { coins: 0, area: 0 }, side: { coins: 0, area: 0 } };
    for (const seed of SEEDS) {
      const { level, coins } = createRun({ seed }).state();
      for (const room of level.rooms) {
        totals[room.kind].coins += coins.filter((c) => inRoom(level, c)?.id === room.id).length;
        totals[room.kind].area += room.width * room.height;
      }
    }
    const main = totals.main.coins / totals.main.area;
    const side = totals.side.coins / totals.side.area;
    expect(side).toBeGreaterThan(main * 1.5);
  });

  it('uses only the five Denominations, mostly 1s and 5s on Level 1', () => {
    const all = SEEDS.flatMap((seed) => createRun({ seed }).state().coins);
    for (const coin of all) expect(DENOMINATIONS).toContain(coin.denomination);
    const low = all.filter((c) => c.denomination <= 5).length;
    expect(low / all.length).toBeGreaterThan(0.6);
  });
});

/** Walks to the first Coin listed in the start Room and returns the Coins collected on the way. */
function collectStartRoomCoin(run: Run, afterEachUpdate?: () => void): { target: Coin; collected: Coin[] } {
  const before = run.state();
  const startRoom = before.level.rooms[before.level.mainPath[0]!]!;
  const target = before.coins.find((c) => inRoom(before.level, c)?.id === startRoom.id)!;
  walkTo(run, target, afterEachUpdate);
  const remaining = new Set(run.state().coins.map((c) => c.id));
  return { target, collected: before.coins.filter((c) => !remaining.has(c.id)) };
}

describe('Coin collection', () => {
  it('starts the Run with a Score of 0 and every Coin in place', () => {
    const run = createRun({ seed: 5 });
    expect(run.state().score).toBe(0);
    expect(run.state().coins).toEqual(run.state().level.coins);
  });

  it('collects a Coin on contact and adds its Denomination to the Score', () => {
    for (const seed of SEEDS.slice(0, 30)) {
      const run = createRun({ seed });
      const { target, collected } = collectStartRoomCoin(run);
      expect(collected.map((c) => c.id)).toContain(target.id);
      expect(run.state().score).toBe(collected.reduce((sum, c) => sum + c.denomination, 0));
    }
  });

  it('adds a Coin to the Score in the same update that collects it', () => {
    const run = createRun({ seed: 5 });
    const all = run.state().coins;
    collectStartRoomCoin(run, () => {
      const { coins, score } = run.state();
      const remaining = new Set(coins.map((c) => c.id));
      const collectedValue = all.filter((c) => !remaining.has(c.id)).reduce((sum, c) => sum + c.denomination, 0);
      expect(score).toBe(collectedValue);
    });
    expect(run.state().score).toBeGreaterThan(0);
  });

  it('collects each Coin only once', () => {
    const run = createRun({ seed: 5 });
    const { target } = collectStartRoomCoin(run);
    const score = run.state().score;
    const { level } = run.state();
    walkTo(run, level.startGate);
    const nearStart = run.state().score;
    walkTo(run, target);
    expect(run.state().score).toBe(nearStart);
    expect(nearStart).toBeGreaterThanOrEqual(score);
  });
});
