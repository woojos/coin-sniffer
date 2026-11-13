// Test helpers that drive a Run through its public interface only.
import type { Direction, Level, Run, Tile } from '../run';

export const key = (t: Tile): string => `${t.x},${t.y}`;
export const isFloor = (level: Level, t: Tile): boolean => level.floor[t.y]?.[t.x] === true;

const NEIGHBOURS: readonly [Direction, number, number][] = [
  ['right', 1, 0],
  ['left', -1, 0],
  ['down', 0, 1],
  ['up', 0, -1],
];

/** Shortest four-direction route over floor tiles, both ends included. */
export function route(level: Level, from: Tile, to: Tile): Tile[] {
  const previous = new Map<string, Tile | null>([[key(from), null]]);
  const queue = [from];
  for (let t = queue.shift(); t; t = queue.shift()) {
    if (key(t) === key(to)) break;
    for (const [, dx, dy] of NEIGHBOURS) {
      const n = { x: t.x + dx, y: t.y + dy };
      if (isFloor(level, n) && !previous.has(key(n))) {
        previous.set(key(n), t);
        queue.push(n);
      }
    }
  }
  const path: Tile[] = [];
  for (let t: Tile | null | undefined = to; t; t = previous.get(key(t))) path.unshift(t);
  if (key(path[0]!) !== key(from)) throw new Error('No route');
  return path;
}

export const minerTile = (run: Run): Tile => {
  const { miner } = run.state();
  return { x: Math.floor(miner.x), y: Math.floor(miner.y) };
};

/**
 * Holds the direction of each route step until the Miner's centre enters the next tile,
 * in coarse 50 ms updates, like a player who does not line up perfectly.
 */
export function walkTo(run: Run, target: Tile, afterEachUpdate?: () => void): void {
  const path = route(run.state().level, minerTile(run), target);
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]!;
    const to = path[i]!;
    const [direction] = NEIGHBOURS.find(([, dx, dy]) => from.x + dx === to.x && from.y + dy === to.y)!;
    for (let updates = 0; key(minerTile(run)) !== key(to); updates++) {
      if (updates > 100) throw new Error(`Miner stuck at ${key(minerTile(run))} heading ${direction}`);
      run.update({ direction }, 50);
      afterEachUpdate?.();
    }
  }
}
