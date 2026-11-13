import { COIN_TUNING, DENOMINATIONS, MINER_TUNING, type Denomination } from '../data/tuning';
import type { Miner } from './miner';
import type { Random } from './random';
import { tileKey, type Tile } from './tile';

/** A Coin lies on one tile, at that tile's centre. */
export interface Coin extends Tile {
  readonly id: number;
  readonly denomination: Denomination;
}

interface CoinArea {
  readonly tiles: readonly Tile[];
  /** Expected Coins per tile. */
  readonly density: number;
}

/**
 * Scatters Coins over each area in proportion to its size: the expected count is
 * tiles × density, rounded up or down at random so small areas still get their share.
 */
export function placeCoins(random: Random, areas: readonly CoinArea[], keepClear: readonly Tile[]): Coin[] {
  const clear = new Set(keepClear.map(tileKey));
  const coins: Coin[] = [];
  for (const area of areas) {
    const free = area.tiles.filter((t) => !clear.has(tileKey(t)));
    const count = Math.min(free.length, Math.floor(free.length * area.density + random.next()));
    for (let i = 0; i < count; i++) {
      const j = random.int(i, free.length - 1);
      [free[i], free[j]] = [free[j]!, free[i]!];
      const { x, y } = free[i]!;
      coins.push({ id: coins.length, x, y, denomination: randomDenomination(random) });
    }
  }
  return coins;
}

function randomDenomination(random: Random): Denomination {
  const weights = COIN_TUNING.denominationWeights;
  let roll = random.next() * DENOMINATIONS.reduce((sum, d) => sum + weights[d], 0);
  for (const denomination of DENOMINATIONS) {
    roll -= weights[denomination];
    if (roll < 0) return denomination;
  }
  return DENOMINATIONS[0];
}

/** Whether the Miner's body overlaps the Coin's pick-up box. */
export function touchesCoin(miner: Miner, coin: Coin): boolean {
  const reach = (MINER_TUNING.size + COIN_TUNING.size) / 2;
  return Math.abs(miner.x - (coin.x + 0.5)) < reach && Math.abs(miner.y - (coin.y + 0.5)) < reach;
}
