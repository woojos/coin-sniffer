import { describe, expect, it } from 'vitest';
import { createRun, type Coin, type Run } from './run';
import { key, minerTile, walkTo } from './testing/walk';

describe('Level progression', () => {
  it('walking onto the end Gate starts Level 2 at its start Gate, keeping the Score', () => {
    const run = createRun({ seed: 7 });
    const first = run.state();
    let lastLevel1Score = 0;
    walkTo(run, first.level.endGate, () => {
      if (run.state().levelNumber === 1) lastLevel1Score = run.state().score;
    });

    const second = run.state();
    expect(second.levelNumber).toBe(2);
    expect(second.level).not.toEqual(first.level);
    expect(key(minerTile(run))).toBe(key(second.level.startGate));
    expect(second.score).toBe(lastLevel1Score);
    expect(second.coins).toEqual(second.level.coins);
    expect(second.visited.corridors).toEqual([]);
    expect(second.visited.rooms).toEqual([second.level.mainPath[0]]);
  });

  it('offers no way back: returning to the start Gate keeps the Miner on the same Level', () => {
    const run = createRun({ seed: 7 });
    walkTo(run, run.state().level.endGate);
    const level2 = run.state().level;
    const startRoom = level2.rooms[level2.mainPath[0]!]!;
    const elsewhere = { x: startRoom.x + Math.floor(startRoom.width / 2), y: startRoom.y + Math.floor(startRoom.height / 2) };

    walkTo(run, elsewhere);
    walkTo(run, level2.startGate);

    expect(run.state().levelNumber).toBe(2);
    expect(run.state().level).toBe(level2);
    expect(key(minerTile(run))).toBe(key(level2.startGate));
  });

  it('counts Levels up through every end Gate, the same way for the same seed', () => {
    const levelsOf = (run: Run) => {
      const seen = [run.state()];
      for (let n = 2; n <= 4; n++) {
        walkTo(run, run.state().level.endGate);
        seen.push(run.state());
      }
      return seen;
    };
    const a = levelsOf(createRun({ seed: 3 }));
    const b = levelsOf(createRun({ seed: 3 }));

    expect(a.map((s) => s.levelNumber)).toEqual([1, 2, 3, 4]);
    expect(a.map((s) => s.level)).toEqual(b.map((s) => s.level));
    expect(new Set(a.map((s) => JSON.stringify(s.level))).size).toBe(4);
  });
});

/** Every Coin as generated on Levels 1 and 5 of Runs with the given seeds. */
function coinsOnLevels1And5(seeds: readonly number[]): { level1: Coin[]; level5: Coin[] } {
  const level1: Coin[] = [];
  const level5: Coin[] = [];
  for (const seed of seeds) {
    const run = createRun({ seed });
    level1.push(...run.state().level.coins);
    while (run.state().levelNumber < 5) walkTo(run, run.state().level.endGate);
    level5.push(...run.state().level.coins);
  }
  return { level1, level5 };
}

const share = (coins: readonly Coin[], test: (c: Coin) => boolean) => coins.filter(test).length / coins.length;

describe('Denomination mix by Level', () => {
  const { level1, level5 } = coinsOnLevels1And5(Array.from({ length: 40 }, (_, i) => i + 1));

  it('fills Level 1 mostly with 1s and 5s and holds no 100s there', () => {
    expect(share(level1, (c) => c.denomination <= 5)).toBeGreaterThan(0.75);
    expect(share(level1, (c) => c.denomination === 100)).toBe(0);
  });

  it('makes later Levels hold more valuable Coins, at the same face values', () => {
    expect(share(level5, (c) => c.denomination <= 5)).toBeLessThan(0.6);
    expect(share(level5, (c) => c.denomination >= 25)).toBeGreaterThan(0.15);
    expect(level5.some((c) => c.denomination === 100)).toBe(true);
    for (const coin of level5) expect([1, 5, 10, 25, 100]).toContain(coin.denomination);
  });
});
