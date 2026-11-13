import { COIN_TUNING, LEVEL_TUNING } from '../data/tuning';
import { denominationWeights, placeCoins, type Coin } from './coins';
import { placeMonsters, type Monster } from './monsters';
import { createRandom, type Random } from './random';
import { tileKey as key, type Tile } from './tile';

export type RoomKind = 'main' | 'side';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Room extends Rect {
  readonly id: number;
  readonly kind: RoomKind;
}

export interface Corridor {
  readonly id: number;
  /** The Room this Corridor leaves, closer to the start Gate. */
  readonly from: number;
  /** The Room this Corridor leads to. */
  readonly to: number;
  /** Tiles in walking order, from the `from` Room to the `to` Room. */
  readonly tiles: readonly Tile[];
}

export interface Level {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  /** `floor[y][x]` is true where the Miner can walk; everything else is wall. */
  readonly floor: readonly (readonly boolean[])[];
  readonly rooms: readonly Room[];
  readonly corridors: readonly Corridor[];
  /** Room ids in order from the start Room to the end Room. */
  readonly mainPath: readonly number[];
  readonly startGate: Tile;
  readonly endGate: Tile;
  /** Every Coin as the Level was generated; the Run tracks which are still uncollected. */
  readonly coins: readonly Coin[];
  /** Every Monster as the Level was generated, idle where it spawned. */
  readonly monsters: readonly Monster[];
}

const MAX_LAYOUT_ATTEMPTS = 1000;
const PLACEMENT_TRIES = 30;
const SIDE_ROOM_TRIES = 10;

/** Generates Level `levelNumber` of a Run (1 for the first); deeper Levels hold more valuable Coins. */
export function generateLevel(seed: number, levelNumber: number): Level {
  const random = createRandom(seed);
  for (let attempt = 0; attempt < MAX_LAYOUT_ATTEMPTS; attempt++) {
    const draft = tryLayout(random);
    if (draft) return toLevel(seed, levelNumber, draft, random);
  }
  throw new Error(`Could not generate a Level for seed ${seed}`);
}

export function roomContains(room: Rect, tile: Tile): boolean {
  return tile.x >= room.x && tile.x < room.x + room.width && tile.y >= room.y && tile.y < room.y + room.height;
}

export type Area = { readonly kind: 'room'; readonly id: number } | { readonly kind: 'corridor'; readonly id: number };

/** The Room or Corridor a floor tile belongs to, or null for a wall. */
export function areaAt(level: Level, tile: Tile): Area | null {
  const room = level.rooms.find((r) => roomContains(r, tile));
  if (room) return { kind: 'room', id: room.id };
  const corridor = level.corridors.find((c) => c.tiles.some((t) => t.x === tile.x && t.y === tile.y));
  return corridor ? { kind: 'corridor', id: corridor.id } : null;
}

interface Proposal {
  readonly room: Rect;
  readonly corridor: readonly Tile[];
}

const CORRIDOR = -1;

/** A Level under construction, in unshifted coordinates. Every new Room hangs off one parent, so the layout is a tree. */
class Draft {
  readonly rooms: { rect: Rect; kind: RoomKind }[] = [];
  readonly corridors: { from: number; to: number; tiles: readonly Tile[] }[] = [];
  /** Floor tile → id of the Room it belongs to, or CORRIDOR. */
  private readonly owners = new Map<string, number>();

  addRoom(rect: Rect, kind: RoomKind): number {
    const id = this.rooms.length;
    this.rooms.push({ rect, kind });
    for (const tile of rectTiles(rect)) this.owners.set(key(tile), id);
    return id;
  }

  addCorridor(from: number, to: number, tiles: readonly Tile[]): void {
    this.corridors.push({ from, to, tiles });
    for (const tile of tiles) this.owners.set(key(tile), CORRIDOR);
  }

  /**
   * A proposal fits when its Room touches no existing floor, and its Corridor touches only
   * the parent Room (at its first tile) and the new Room (at its last tile). That keeps at
   * least one wall between unrelated areas, so no loops can form.
   */
  fits(parent: number, proposal: Proposal): boolean {
    const { room, corridor } = proposal;
    for (const tile of rectTiles(room)) {
      if (around(tile).some((n) => this.owners.has(key(n)))) return false;
    }
    return corridor.every((tile, index) => {
      if (this.owners.has(key(tile))) return false;
      return around(tile).every((n) => {
        const owner = this.owners.get(key(n));
        if (owner !== undefined && !(index === 0 && owner === parent)) return false;
        return index === corridor.length - 1 || !roomContains(room, n);
      });
    });
  }
}

function tryLayout(random: Random): Draft | null {
  const tuning = LEVEL_TUNING;
  const roomCount = random.int(tuning.roomCount.min, tuning.roomCount.max);
  const sideCount = random.int(
    tuning.sideRoomCount.min,
    Math.min(tuning.sideRoomCount.max, roomCount - tuning.minMainPathRooms),
  );
  const mainCount = roomCount - sideCount;

  const draft = new Draft();
  draft.addRoom({ x: 0, y: 0, ...randomRoomSize(random) }, 'main');
  for (let id = 1; id < mainCount; id++) {
    if (!attach(draft, random, id - 1, 'main')) return null;
  }

  // Side Rooms hang off any Main Path Room except the last, so the end Room stays a dead end.
  const sideParents = Array.from({ length: mainCount - 1 }, (_, id) => id);
  for (let side = 0; side < sideCount; side++) {
    let placed = false;
    for (let tries = 0; tries < SIDE_ROOM_TRIES && !placed; tries++) {
      placed = attach(draft, random, random.pick(sideParents), 'side');
    }
    if (!placed) return null;
  }
  return draft;
}

function attach(draft: Draft, random: Random, parent: number, kind: RoomKind): boolean {
  const parentRect = draft.rooms[parent]!.rect;
  for (let tries = 0; tries < PLACEMENT_TRIES; tries++) {
    const proposal = propose(random, parentRect);
    if (draft.fits(parent, proposal)) {
      const id = draft.addRoom(proposal.room, kind);
      draft.addCorridor(parent, id, proposal.corridor);
      return true;
    }
  }
  return false;
}

/**
 * Proposes a Room beside `parent` joined by a straight or L-shaped Corridor. Works in
 * "along" (the direction the Corridor leaves) and "across" coordinates so that one
 * routine covers all four directions.
 */
function propose(random: Random, parent: Rect): Proposal {
  const horizontal = random.next() < 0.5;
  const sign = random.pick([1, -1] as const);
  const size = randomRoomSize(random);
  const leg = (): number => random.int(LEVEL_TUNING.corridorLeg.min, LEVEL_TUNING.corridorLeg.max);

  const tile = (along: number, across: number): Tile =>
    horizontal ? { x: along, y: across } : { x: across, y: along };
  const rect = (along: number, alongLen: number, across: number, acrossLen: number): Rect =>
    horizontal
      ? { x: along, y: across, width: alongLen, height: acrossLen }
      : { x: across, y: along, width: acrossLen, height: alongLen };

  const parentAlong = horizontal ? parent.x : parent.y;
  const parentAlongLen = horizontal ? parent.width : parent.height;
  const parentAcross = horizontal ? parent.y : parent.x;
  const parentAcrossLen = horizontal ? parent.height : parent.width;
  const roomAlongLen = horizontal ? size.width : size.height;
  const roomAcrossLen = horizontal ? size.height : size.width;

  const lane = random.int(parentAcross, parentAcross + parentAcrossLen - 1);
  /** The first Corridor tile, just outside the parent Room's wall. */
  const mouth = sign > 0 ? parentAlong + parentAlongLen : parentAlong - 1;

  if (random.next() >= LEVEL_TUNING.bentCorridorChance) {
    const length = leg();
    const corridor = Array.from({ length }, (_, i) => tile(mouth + sign * i, lane));
    const near = mouth + sign * length;
    const roomAlong = sign > 0 ? near : near - roomAlongLen + 1;
    const roomAcross = random.int(lane - roomAcrossLen + 1, lane);
    return { room: rect(roomAlong, roomAlongLen, roomAcross, roomAcrossLen), corridor };
  }

  const firstLeg = leg();
  const secondLeg = leg();
  const turn = random.pick([1, -1] as const);
  const corner = mouth + sign * (firstLeg - 1);
  const corridor = [
    ...Array.from({ length: firstLeg }, (_, i) => tile(mouth + sign * i, lane)),
    ...Array.from({ length: secondLeg }, (_, j) => tile(corner, lane + turn * (j + 1))),
  ];
  const near = lane + turn * (secondLeg + 1);
  const roomAcross = turn > 0 ? near : near - roomAcrossLen + 1;
  const roomAlong = random.int(corner - roomAlongLen + 1, corner);
  return { room: rect(roomAlong, roomAlongLen, roomAcross, roomAcrossLen), corridor };
}

function randomRoomSize(random: Random): { width: number; height: number } {
  const { roomWidth, roomHeight } = LEVEL_TUNING;
  return {
    width: random.int(roomWidth.min, roomWidth.max),
    height: random.int(roomHeight.min, roomHeight.max),
  };
}

/** Shifts the draft so a one-tile wall border surrounds it, then places the Gates, Coins and Monsters. */
function toLevel(seed: number, levelNumber: number, draft: Draft, random: Random): Level {
  const tiles = [
    ...draft.rooms.flatMap((room) => rectTiles(room.rect)),
    ...draft.corridors.flatMap((corridor) => corridor.tiles),
  ];
  const minX = Math.min(...tiles.map((t) => t.x)) - 1;
  const minY = Math.min(...tiles.map((t) => t.y)) - 1;
  const width = Math.max(...tiles.map((t) => t.x)) - minX + 2;
  const height = Math.max(...tiles.map((t) => t.y)) - minY + 2;
  const shift = (t: Tile): Tile => ({ x: t.x - minX, y: t.y - minY });

  const floor = Array.from({ length: height }, () => new Array<boolean>(width).fill(false));
  for (const t of tiles) floor[t.y - minY]![t.x - minX] = true;

  const rooms: Room[] = draft.rooms.map(({ rect, kind }, id) => ({ id, ...rect, ...shift(rect), kind }));
  const corridors: Corridor[] = draft.corridors.map((c, id) => ({ ...c, id, tiles: c.tiles.map(shift) }));
  const mainPath = rooms.filter((room) => room.kind === 'main').map((room) => room.id);

  const startRoom = rooms[mainPath[0]!]!;
  const endRoom = rooms[mainPath[mainPath.length - 1]!]!;
  const startMouth = corridors.find((c) => c.from === startRoom.id && c.to === mainPath[1])!.tiles[0]!;
  const entryCorridor = corridors.find((c) => c.to === endRoom.id)!;
  const entryTile = entryCorridor.tiles[entryCorridor.tiles.length - 1]!;

  const startGate = farthestTile(startRoom, startMouth);
  const endGate = farthestTile(endRoom, entryTile);
  const roomDensity = (room: Room): number =>
    COIN_TUNING.roomDensity * (room.kind === 'side' ? COIN_TUNING.sideRoomRichness : 1);
  const coins = placeCoins(
    random,
    denominationWeights(levelNumber),
    [
      ...rooms.map((room) => ({ tiles: rectTiles(room), density: roomDensity(room) })),
      ...corridors.map((corridor) => ({ tiles: corridor.tiles, density: COIN_TUNING.corridorDensity })),
    ],
    [startGate, endGate],
  );
  const monsters = placeMonsters(random, rooms, startRoom.id, [startGate, endGate]);

  return { seed, width, height, floor, rooms, corridors, mainPath, startGate, endGate, coins, monsters };
}

function farthestTile(rect: Rect, from: Tile): Tile {
  let best = { x: rect.x, y: rect.y };
  let bestDistance = -1;
  for (const tile of rectTiles(rect)) {
    const distance = Math.abs(tile.x - from.x) + Math.abs(tile.y - from.y);
    if (distance > bestDistance) {
      best = tile;
      bestDistance = distance;
    }
  }
  return best;
}

export function rectTiles(rect: Rect): Tile[] {
  const tiles: Tile[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) tiles.push({ x, y });
  }
  return tiles;
}

/** The tile itself and its eight neighbours. */
function around(tile: Tile): Tile[] {
  const tiles: Tile[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) tiles.push({ x: tile.x + dx, y: tile.y + dy });
  }
  return tiles;
}
