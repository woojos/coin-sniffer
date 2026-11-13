import type { Weapon } from '../data/tuning';
import type { Direction, Miner } from './miner';

/** Angle of each facing in radians, clockwise from the right, as on screen where y grows downwards. */
export const FACING_ANGLE: Readonly<Record<Direction, number>> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};

/**
 * Whether a point lies inside the arc a Swing of `weapon` sweeps in front of the Miner: within
 * reach of his centre and within half the arc width either side of his facing. A point right
 * on his centre counts as inside, since it has no direction.
 */
export function inSwingArc(miner: Miner, weapon: Weapon, point: { readonly x: number; readonly y: number }): boolean {
  const dx = point.x - miner.x;
  const dy = point.y - miner.y;
  const gap = Math.hypot(dx, dy);
  if (gap > weapon.reach) return false;
  if (gap < 1e-9) return true;
  const turn = Math.atan2(dy, dx) - FACING_ANGLE[miner.facing];
  const offAxis = Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn)));
  return offAxis <= halfArc(weapon);
}

/** Half the Weapon's arc width, in radians: how far the arc reaches either side of the facing. */
export function halfArc(weapon: Weapon): number {
  return (weapon.arcWidthDegrees * Math.PI) / 360;
}
