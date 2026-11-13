// Tuning values, kept apart from the rules that use them.

export interface Range {
  readonly min: number;
  readonly max: number;
}

export const LEVEL_TUNING = {
  roomCount: { min: 4, max: 6 },
  sideRoomCount: { min: 1, max: 2 },
  /** Fewest Rooms on the Main Path, start and end Rooms included. */
  minMainPathRooms: 3,
  roomWidth: { min: 8, max: 16 },
  roomHeight: { min: 8, max: 12 },
  /** Length of each straight leg of a Corridor, in tiles. */
  corridorLeg: { min: 3, max: 7 },
} as const;

export const MINER_TUNING = {
  /** Tiles per second. */
  speed: 5,
  /** Width and height of the Miner's body, in tiles. */
  size: 0.7,
} as const;
