import type { LoadInput, SimulationResult } from './types';
import { simulate } from './model';

export interface LadderRow {
  chargeGr: number;
  result: SimulationResult;
}

/** Simulates a charge ladder from `from` to `to` (inclusive) in `step` grain increments. */
export function chargeLadder(base: LoadInput, from: number, to: number, step: number): LadderRow[] {
  if (!(step > 0) || to < from) return [];
  const rows: LadderRow[] = [];
  const n = Math.min(200, Math.floor((to - from) / step + 1e-9) + 1);
  for (let i = 0; i < n; i++) {
    const chargeGr = Math.round((from + i * step) * 1000) / 1000;
    rows.push({ chargeGr, result: simulate({ ...base, chargeGr }) });
  }
  return rows;
}

/**
 * Finds the charge that gives the target peak pressure (bisection).
 * Returns NaN if the target cannot be bracketed.
 */
export function chargeForPressure(base: LoadInput, targetMPa: number, lo = 1, hi?: number): number {
  const cap = base.capacityGrH2O ?? base.cartridge.capacityGrH2O;
  let h = hi ?? cap * 1.3;
  let l = lo;
  const p = (c: number) => {
    const r = simulate({ ...base, chargeGr: c });
    return r.ok ? r.maxPressure : r.errors.some((e) => e.includes('did not leave')) ? 0 : Infinity;
  };
  if (p(l) > targetMPa) return NaN;
  if (p(h) < targetMPa) {
    // Shrink upper bound until valid
    while (h > l && !Number.isFinite(p(h))) h *= 0.95;
    if (p(h) < targetMPa) return NaN;
  }
  for (let i = 0; i < 40; i++) {
    const mid = 0.5 * (l + h);
    if (p(mid) > targetMPa) h = mid;
    else l = mid;
    if (h - l < 0.01) break;
  }
  return 0.5 * (l + h);
}
