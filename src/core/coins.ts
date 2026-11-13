import { COIN_TUNING, DENOMINATIONS, type Denomination } from '../data/tuning';
import type { Random } from './random';

export interface Coin {
  readonly id: number;
  /** The tile the Coin lies on; it sits at that tile's centre. */
  readonly x: number;
  readonly y: number;
  readonly denomination: Denomination;
}

interface CoinArea {
  readonly tiles: readonly { readonly x: number; readonly y: number }[];
  /** Expected Coins per tile. */
  readonly density: number;
}

/**
 * Scatters Coins over each area in proportion to its size: the expected count is
 * tiles × density, rounded up or down at random so small areas still get their share.
 */
export function placeCoins(random: Random, areas: readonly CoinArea[], keepClear: ReadonlySet<string>): Coin[] {
  const coins: Coin[] = [];
  for (const area of areas) {
    const free = area.tiles.filter((t) => !keepClear.has(`${t.x},${t.y}`));
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

/** Whether a Miner body of half-size `half` centred at (x, y) touches the Coin. */
export function touchesCoin(x: number, y: number, half: number, coin: Coin): boolean {
  const reach = half + COIN_TUNING.size / 2;
  return Math.abs(x - (coin.x + 0.5)) < reach && Math.abs(y - (coin.y + 0.5)) < reach;
}
