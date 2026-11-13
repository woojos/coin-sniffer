// Tuning values, kept apart from the rules that use them.

export const LEVEL_TUNING = {
  roomCount: { min: 4, max: 6 },
  sideRoomCount: { min: 1, max: 2 },
  /** Fewest Rooms on the Main Path, start and end Rooms included. */
  minMainPathRooms: 3,
  roomWidth: { min: 8, max: 16 },
  roomHeight: { min: 8, max: 12 },
  /** Length of each straight leg of a Corridor, in tiles. */
  corridorLeg: { min: 3, max: 7 },
  /** Chance that a Corridor bends once (L-shaped) instead of running straight. */
  bentCorridorChance: 0.5,
} as const;

export const MINER_TUNING = {
  /** Tiles per second. */
  speed: 5,
  /** Width and height of the Miner's body, in tiles. */
  size: 0.7,
} as const;

/** Face values of the five Coin Denominations. They never change. */
export const DENOMINATIONS = [1, 5, 10, 25, 100] as const;
export type Denomination = (typeof DENOMINATIONS)[number];

export const COIN_TUNING = {
  /** Relative chance of each Denomination. A single table for now; it varies by Level later. */
  denominationWeights: { 1: 55, 5: 30, 10: 12, 25: 3, 100: 0 } satisfies Record<Denomination, number>,
  /** Expected Coins per floor tile of a Main Path Room. */
  roomDensity: 0.04,
  /** Expected Coins per Corridor tile. */
  corridorDensity: 0.08,
  /** Side Rooms hold this many times more Coins per tile than Main Path Rooms. */
  sideRoomRichness: 2.5,
  /** Width and height of a Coin's pick-up box, in tiles. */
  size: 0.4,
} as const;
