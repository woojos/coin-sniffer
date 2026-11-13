import { describe, expect, it } from 'vitest';
import { MINER_TUNING, MONSTER_TUNING } from '../data/tuning';
import { createRun, type Level, type Monster, type Run } from './run';
import { key, walkTo } from './testing/walk';

const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);

const roomOf = (level: Level, m: Monster) =>
  level.rooms.find((r) => m.x >= r.x && m.x < r.x + r.width && m.y >= r.y && m.y < r.y + r.height);
const onCorridor = (level: Level, m: Monster) =>
  level.corridors.some((c) => c.tiles.some((t) => t.x === Math.floor(m.x) && t.y === Math.floor(m.y)));

describe('Crawler placement', () => {
  it('puts idle Crawlers in every Room but the start Room, none in Corridors and never on a Gate', () => {
    for (const seed of SEEDS) {
      const { level, monsters } = createRun({ seed }).state();
      const startRoom = level.mainPath[0]!;
      for (const m of monsters) {
        expect(m.kind).toBe('crawler');
        expect(m.awake).toBe(false);
        const room = roomOf(level, m);
        expect(room?.id).toBe(m.room);
        expect(m.room).not.toBe(startRoom);
        expect(onCorridor(level, m)).toBe(false);
        const tile = { x: Math.floor(m.x), y: Math.floor(m.y) };
        expect(key(tile)).not.toBe(key(level.startGate));
        expect(key(tile)).not.toBe(key(level.endGate));
      }
      for (const room of level.rooms.filter((r) => r.id !== startRoom)) {
        const count = monsters.filter((m) => m.room === room.id).length;
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThanOrEqual(MONSTER_TUNING.maxPerRoom);
      }
    }
  });

  it('packs Side Rooms more densely than Main Path Rooms', () => {
    const totals = { main: { monsters: 0, area: 0 }, side: { monsters: 0, area: 0 } };
    for (const seed of SEEDS) {
      const { level, monsters } = createRun({ seed }).state();
      for (const room of level.rooms.slice(1)) {
        totals[room.kind].monsters += monsters.filter((m) => m.room === room.id).length;
        totals[room.kind].area += room.width * room.height;
      }
    }
    const main = totals.main.monsters / totals.main.area;
    const side = totals.side.monsters / totals.side.area;
    expect(side).toBeGreaterThan(main * 1.5);
  });
});

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const tileOf = (m: { x: number; y: number }) => ({ x: Math.floor(m.x), y: Math.floor(m.y) });

/** The first Crawler of the Room after the start Room on the Main Path. */
function firstCrawler(run: Run): Monster {
  const { level, monsters } = run.state();
  return monsters.find((m) => m.room === level.mainPath[1])!;
}

const current = (run: Run, crawler: Monster) => run.state().monsters.find((m) => m.id === crawler.id)!;

describe('Crawler awareness', () => {
  it('idles until the Miner comes within sight, then chases him', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const run = createRun({ seed });
      const crawler = firstCrawler(run);
      walkTo(run, tileOf(crawler), () => {
        const now = current(run, crawler);
        // The Miner moves at most a quarter tile per update, so this far away he cannot have been seen yet.
        if (distance(run.state().miner, now) > MONSTER_TUNING.crawler.sightRange + 0.25) {
          expect(now.awake).toBe(false);
          expect(now).toEqual(crawler);
        }
      });
      const now = current(run, crawler);
      expect(now.awake).toBe(true);
      expect(now).not.toEqual({ ...crawler, awake: true });
    }
  });

  it('gives up once the Miner gets far away, and then stays where it stopped', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const run = createRun({ seed });
      const crawler = firstCrawler(run);
      walkTo(run, tileOf(crawler));
      walkTo(run, run.state().level.startGate);

      const stopped = current(run, crawler);
      expect(stopped.awake).toBe(false);
      for (let i = 0; i < 40; i++) run.update({ direction: null }, 50);
      expect(current(run, crawler)).toEqual(stopped);
    }
  });
});

describe('Crawler confinement', () => {
  it('keeps every Crawler inside its Room while the Miner crosses the Level', () => {
    const half = MONSTER_TUNING.crawler.size / 2;
    for (const seed of SEEDS.slice(0, 20)) {
      const run = createRun({ seed });
      const { level } = run.state();
      let moved = 0;
      walkTo(run, level.endGate, () => {
        if (run.state().level !== level) return;
        for (const m of run.state().monsters) {
          const room = level.rooms[m.room]!;
          expect(m.x - half).toBeGreaterThanOrEqual(room.x - 1e-9);
          expect(m.x + half).toBeLessThanOrEqual(room.x + room.width + 1e-9);
          expect(m.y - half).toBeGreaterThanOrEqual(room.y - 1e-9);
          expect(m.y + half).toBeLessThanOrEqual(room.y + room.height + 1e-9);
          if (m.awake) moved++;
        }
      });
      expect(moved).toBeGreaterThan(0);
    }
  });
});

const { damage } = MONSTER_TUNING.crawler;

describe('Contact damage', () => {
  it('starts the Run at full Life and not invulnerable', () => {
    const { life, invulnerableMs } = createRun({ seed: 1 }).state();
    expect(life).toBe(MINER_TUNING.life);
    expect(invulnerableMs).toBe(0);
  });

  it("takes the Crawler's damage from Life on contact and starts the invulnerability window", () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const run = createRun({ seed });
      let previous = run.state().life;
      let hits = 0;
      walkTo(run, tileOf(firstCrawler(run)), () => {
        const { life, invulnerableMs } = run.state();
        if (life !== previous) {
          expect(previous - life).toBe(damage);
          expect(invulnerableMs).toBeGreaterThan(MINER_TUNING.invulnerabilityMs - 50);
          hits++;
        }
        previous = life;
      });
      for (let i = 0; i < 10; i++) run.update({ direction: null }, 50);
      hits += previous === run.state().life ? 0 : 1;
      expect(hits).toBeGreaterThan(0);
    }
  });

  it('takes no damage during the invulnerability window, then can be hit again', () => {
    const run = createRun({ seed: 3 });
    walkTo(run, tileOf(firstCrawler(run)));
    const hitTimes: number[] = [];
    let previous = run.state().life;
    for (let t = 50; t <= 4000; t += 50) {
      run.update({ direction: null }, 50);
      if (run.state().life < previous) hitTimes.push(t);
      previous = run.state().life;
    }
    expect(hitTimes.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < hitTimes.length; i++) {
      const gap = hitTimes[i]! - hitTimes[i - 1]!;
      expect(gap).toBeGreaterThanOrEqual(MINER_TUNING.invulnerabilityMs);
      expect(gap).toBeLessThanOrEqual(MINER_TUNING.invulnerabilityMs + 50);
    }
  });
});

describe('Life across Levels', () => {
  it('carries Life over into the next Level and never regenerates it', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const run = createRun({ seed });
      walkTo(run, tileOf(firstCrawler(run)));
      let previous = run.state().life;
      let lastLevel1Life = previous;
      const check = () => {
        const { life, levelNumber } = run.state();
        expect(life).toBeLessThanOrEqual(previous);
        if (levelNumber === 1) lastLevel1Life = life;
        previous = life;
      };
      walkTo(run, run.state().level.endGate, check);
      expect(run.state().levelNumber).toBe(2);
      expect(run.state().life).toBe(lastLevel1Life);
      expect(run.state().life).toBeLessThan(MINER_TUNING.life);
      for (let i = 0; i < 100; i++) {
        run.update({ direction: null }, 50);
        check();
      }
    }
  });
});

describe('Death', () => {
  /** Leaves the Miner standing on a Crawler until the Run ends. */
  function dieOnSeed(seed: number): Run {
    const run = createRun({ seed });
    walkTo(run, tileOf(firstCrawler(run)));
    for (let i = 0; i < 1000 && run.state().status === 'playing'; i++) run.update({ direction: null }, 50);
    return run;
  }

  it('ends the Run when Life reaches zero, keeping the Score and Level reached', () => {
    const run = dieOnSeed(3);
    const { status, life, score, levelNumber } = run.state();
    expect(status).toBe('over');
    expect(life).toBe(0);
    expect(levelNumber).toBe(1);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('stays over: nothing moves or changes after the Run ends', () => {
    const run = dieOnSeed(3);
    const ended = run.state();
    for (const direction of ['up', 'down', 'left', 'right', null] as const) {
      for (let i = 0; i < 20; i++) run.update({ direction }, 50);
    }
    expect(run.state()).toEqual(ended);
  });
});

describe('A Run without Monsters', () => {
  it('spawns none, so the Miner is never hurt', () => {
    const run = createRun({ seed: 3, monsters: false });
    expect(run.state().monsters).toEqual([]);
    walkTo(run, run.state().level.endGate);
    expect(run.state().life).toBe(MINER_TUNING.life);
  });
});
