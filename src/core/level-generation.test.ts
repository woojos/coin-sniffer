import { describe, expect, it } from 'vitest';
import { createRun, type Level, type Tile } from './run';

const levelFor = (seed: number) => createRun({ seed }).state().level;
const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

const key = (t: Tile) => `${t.x},${t.y}`;
const isFloor = (level: Level, t: Tile) => level.floor[t.y]?.[t.x] === true;

/** Floor tiles reachable from `from` by four-direction steps, skipping `blocked`. */
function reachable(level: Level, from: Tile, blocked: ReadonlySet<string> = new Set()): Set<string> {
  const seen = new Set([key(from)]);
  const queue = [from];
  for (let t = queue.shift(); t; t = queue.shift()) {
    for (const n of [
      { x: t.x + 1, y: t.y },
      { x: t.x - 1, y: t.y },
      { x: t.x, y: t.y + 1 },
      { x: t.x, y: t.y - 1 },
    ]) {
      if (isFloor(level, n) && !seen.has(key(n)) && !blocked.has(key(n))) {
        seen.add(key(n));
        queue.push(n);
      }
    }
  }
  return seen;
}

const roomOf = (level: Level, t: Tile) =>
  level.rooms.find((r) => t.x >= r.x && t.x < r.x + r.width && t.y >= r.y && t.y < r.y + r.height);

describe('Level generation', () => {
  it('produces the same Level for the same seed', () => {
    expect(levelFor(42)).toEqual(levelFor(42));
  });

  it('produces different Levels for different seeds', () => {
    expect(levelFor(1)).not.toEqual(levelFor(2));
  });

  it('has 4 to 6 Rooms, 1 or 2 of them Side Rooms', () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      expect(level.rooms.length).toBeGreaterThanOrEqual(4);
      expect(level.rooms.length).toBeLessThanOrEqual(6);
      const sideRooms = level.rooms.filter((r) => r.kind === 'side').length;
      expect(sideRooms).toBeGreaterThanOrEqual(1);
      expect(sideRooms).toBeLessThanOrEqual(2);
    }
  });

  it('makes Rooms plain rectangles from 8x8 up to 16x12 tiles', () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      for (const room of level.rooms) {
        expect(room.width).toBeGreaterThanOrEqual(8);
        expect(room.width).toBeLessThanOrEqual(16);
        expect(room.height).toBeGreaterThanOrEqual(8);
        expect(room.height).toBeLessThanOrEqual(12);
        for (let y = room.y; y < room.y + room.height; y++) {
          for (let x = room.x; x < room.x + room.width; x++) expect(isFloor(level, { x, y })).toBe(true);
        }
      }
    }
  });

  it('links all Rooms with no loops: cutting any Corridor splits the Level', () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      const allFloor = reachable(level, level.startGate);
      const floorCount = level.floor.flat().filter(Boolean).length;
      expect(allFloor.size).toBe(floorCount);

      const corridorTiles = new Set(level.corridors.flatMap((c) => c.tiles.map(key)));
      for (const room of level.rooms) {
        const cutOff = reachable(level, { x: room.x, y: room.y }, corridorTiles);
        expect(cutOff.size).toBe(room.width * room.height);
      }
      expect(level.corridors.length).toBe(level.rooms.length - 1);
    }
  });

  it('keeps Corridors narrow: one tile wide', () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      for (const corridor of level.corridors) {
        for (const t of corridor.tiles) {
          expect(roomOf(level, t)).toBeUndefined();
          const sideways = [
            { x: t.x + 1, y: t.y },
            { x: t.x - 1, y: t.y },
            { x: t.x, y: t.y + 1 },
            { x: t.x, y: t.y - 1 },
          ].filter((n) => isFloor(level, n));
          expect(sideways.length).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('makes every Side Room a dead end off the Main Path', () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      for (const room of level.rooms.filter((r) => r.kind === 'side')) {
        const links = level.corridors.filter((c) => c.from === room.id || c.to === room.id);
        expect(links).toHaveLength(1);
        expect(level.mainPath).toContain(links[0]!.from);
      }
    }
  });

  it('puts the start Gate in the first Room and the end Gate in the last Main Path Room', () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      expect(roomOf(level, level.startGate)?.id).toBe(level.mainPath[0]);
      const endRoom = roomOf(level, level.endGate);
      expect(endRoom?.id).toBe(level.mainPath[level.mainPath.length - 1]);
      expect(endRoom?.kind).toBe('main');
    }
  });

  it('reaches the end Gate from the start Gate along the Main Path', () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      const path = level.mainPath;
      expect(path.length).toBeGreaterThanOrEqual(3);
      for (let i = 0; i + 1 < path.length; i++) {
        expect(level.corridors.some((c) => c.from === path[i] && c.to === path[i + 1])).toBe(true);
      }
      const sideRoomTiles = new Set(
        level.rooms
          .filter((r) => r.kind === 'side')
          .flatMap((r) => Array.from({ length: r.width * r.height }, (_, n) => key({ x: r.x + (n % r.width), y: r.y + Math.floor(n / r.width) }))),
      );
      expect(reachable(level, level.startGate, sideRoomTiles).has(key(level.endGate))).toBe(true);
    }
  });
});
