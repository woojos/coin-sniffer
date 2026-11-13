/** A grid square of a Level, in whole tile coordinates. */
export interface Tile {
  readonly x: number;
  readonly y: number;
}

/** A string key for a tile, for use in sets and maps. */
export const tileKey = (tile: Tile): string => `${tile.x},${tile.y}`;
