import { MINER_TUNING, MONSTER_TUNING } from '../data/tuning';
import { rectTiles, type Room } from './level';
import type { Miner } from './miner';
import type { Random } from './random';
import { tileKey, type Tile } from './tile';

export type MonsterKind = 'crawler';

export interface Monster {
  readonly id: number;
  readonly kind: MonsterKind;
  /** The Room the Monster belongs to and never leaves. */
  readonly room: number;
  /** Centre of the Monster's body, in tiles. */
  readonly x: number;
  readonly y: number;
  /** True while the Monster is chasing the Miner; false while it idles. */
  readonly awake: boolean;
}

/**
 * Spawns an idle group of Crawlers in each Room but the start Room, sized by the Room's
 * area, denser in Side Rooms and capped per Room. Each stands at the centre of its own tile.
 */
export function placeMonsters(
  random: Random,
  rooms: readonly Room[],
  startRoom: number,
  keepClear: readonly Tile[],
): Monster[] {
  const clear = new Set(keepClear.map(tileKey));
  const monsters: Monster[] = [];
  for (const room of rooms) {
    if (room.id === startRoom) continue;
    const density = MONSTER_TUNING.roomDensity * (room.kind === 'side' ? MONSTER_TUNING.sideRoomRichness : 1);
    const free = rectTiles(room).filter((t) => !clear.has(tileKey(t)));
    const count = Math.min(free.length, MONSTER_TUNING.maxPerRoom, Math.max(1, Math.round(free.length * density)));
    for (let i = 0; i < count; i++) {
      const j = random.int(i, free.length - 1);
      [free[i], free[j]] = [free[j]!, free[i]!];
      const { x, y } = free[i]!;
      monsters.push({ id: monsters.length, kind: 'crawler', room: room.id, x: x + 0.5, y: y + 0.5, awake: false });
    }
  }
  return monsters;
}

/**
 * Advances one Monster by `elapsedMs`: it wakes when the Miner comes within sight, gives up
 * when he gets beyond its larger give-up range, and while awake walks straight at him. Its
 * body never leaves its Room, so it waits at the Room's edge when he is out in a Corridor.
 */
export function updateMonster(monster: Monster, room: Room, miner: Miner, elapsedMs: number): Monster {
  const tuning = MONSTER_TUNING[monster.kind];
  const dx = miner.x - monster.x;
  const dy = miner.y - monster.y;
  const gap = Math.hypot(dx, dy);
  const awake = monster.awake ? gap <= tuning.giveUpRange : gap <= tuning.sightRange;
  if (!awake) return monster.awake ? { ...monster, awake } : monster;

  const step = Math.min(gap, (tuning.speed * elapsedMs) / 1000);
  const half = tuning.size / 2;
  const scale = gap > 0 ? step / gap : 0;
  return {
    ...monster,
    awake,
    x: clamp(monster.x + dx * scale, room.x + half, room.x + room.width - half),
    y: clamp(monster.y + dy * scale, room.y + half, room.y + room.height - half),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Whether the Monster's body overlaps the Miner's. */
export function touchesMiner(monster: Monster, miner: Miner): boolean {
  const reach = (MONSTER_TUNING[monster.kind].size + MINER_TUNING.size) / 2;
  return Math.abs(miner.x - monster.x) < reach && Math.abs(miner.y - monster.y) < reach;
}
