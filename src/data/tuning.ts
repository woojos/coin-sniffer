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
  /** Life at the start of a Run, in whole points. It never refills. */
  life: 100,
  /** How long the Miner cannot be hurt again after a hit. */
  invulnerabilityMs: 1000,
} as const;

/** Face values of the five Coin Denominations. They never change. */
export const DENOMINATIONS = [1, 5, 10, 25, 100] as const;
export type Denomination = (typeof DENOMINATIONS)[number];

export type DenominationWeights = Readonly<Record<Denomination, number>>;

export const COIN_TUNING = {
  /**
   * Relative chance of each Denomination, by Level number: entry 0 is Level 1. Levels past the
   * end of the table use its last entry. Face values never change; only the mix shifts upwards.
   */
  denominationWeightsByLevel: [
    { 1: 55, 5: 30, 10: 12, 25: 3, 100: 0 },
    { 1: 45, 5: 32, 10: 16, 25: 6, 100: 1 },
    { 1: 35, 5: 32, 10: 20, 25: 10, 100: 3 },
    { 1: 27, 5: 30, 10: 24, 25: 14, 100: 5 },
    { 1: 20, 5: 27, 10: 26, 25: 18, 100: 9 },
  ] satisfies readonly DenominationWeights[],
  /** Expected Coins per floor tile of a Main Path Room. */
  roomDensity: 0.04,
  /**
   * Expected Coins per Corridor tile. Higher than in Rooms because Corridors are short
   * (3 to 14 tiles), so at Room density most would hold no Coin at all.
   */
  corridorDensity: 0.08,
  /** Side Rooms hold this many times more Coins per tile than Main Path Rooms. */
  sideRoomRichness: 2.5,
  /** Width and height of a Coin's pick-up box, in tiles. */
  size: 0.4,
} as const;

export const MONSTER_TUNING = {
  crawler: {
    /** Life at spawn; Swings take it away and the Crawler is removed at zero. */
    life: 30,
    /** Tiles per second; slower than the Miner so he can always get away. */
    speed: 2,
    /** Width and height of the Crawler's body, in tiles. */
    size: 0.7,
    /** Life taken from the Miner on contact. */
    damage: 10,
    /** Wakes when the Miner's centre comes this close, in tiles. */
    sightRange: 5,
    /** Gives up when the Miner's centre gets farther than this, in tiles. */
    giveUpRange: 8,
  },
  /** Expected Monsters per floor tile of a Main Path Room. */
  roomDensity: 0.02,
  /** Side Rooms hold this many times more Monsters per tile than Main Path Rooms. */
  sideRoomRichness: 2,
  /** Most Monsters a single Room ever holds. */
  maxPerRoom: 5,
  /** How long a Monster flashes after a Swing hits it. */
  hitFlashMs: 150,
} as const;

/** Everything that describes a Weapon, so new ones can be added as data alone. */
export interface Weapon {
  /** Life taken from each Monster a Swing hits. */
  readonly attackStrength: number;
  /** Shortest time from the start of one Swing to the start of the next. */
  readonly cooldownMs: number;
  /** Time from pressing Swing to the hit landing. */
  readonly swingTimeMs: number;
  /** How far from the Miner's centre the arc reaches, in tiles. */
  readonly reach: number;
  /** Full angle of the arc, centred on the facing direction, in degrees. */
  readonly arcWidthDegrees: number;
}

/** The Weapon every Miner starts with. */
export const SWORD: Weapon = {
  attackStrength: 10,
  cooldownMs: 400,
  swingTimeMs: 120,
  reach: 1.5,
  arcWidthDegrees: 120,
};
