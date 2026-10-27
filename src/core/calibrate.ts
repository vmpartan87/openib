/**
 * Powder calibration: adjusts powder parameters so that predicted muzzle
 * velocities match chronograph measurements.
 *
 *  - mode 'burnRate': fits the burn-rate coefficient only (1 parameter, needs ≥ 1 point)
 *  - mode 'burnRate+impetus': fits burn rate and an impetus scale (needs ≥ 2 distinct charges)
 */
import type { LoadInput, Powder } from './types';
import { simulate } from './model';

export interface CalibrationPoint {
  load: Omit<LoadInput, 'powder'>;
  /** Measured mean muzzle velocity, m/s */
  velocity: number;
}

export type CalibrationMode = 'burnRate' | 'burnRate+impetus';

export interface CalibrationResult {
  ok: boolean;
  message: string;
  powder: Powder;
  burnRateFactor: number;
  impetusFactor: number;
  /** Root-mean-square velocity error, m/s */
  rms: number;
  rows: { chargeGr: number; measured: number; predicted: number; maxPressure: number }[];
  evaluations: number;
}

export function calibratePowder(
  powder: Powder,
  points: CalibrationPoint[],
  mode: CalibrationMode = 'burnRate',
  dt = 2e-7,
): CalibrationResult {
  let evaluations = 0;
  const valid = points.filter((p) => p.velocity > 0 && p.load.chargeGr > 0);
  const make = (kb: number, ki: number): Powder => ({
    ...powder,
    burnRate: powder.burnRate * kb,
    impetus: powder.impetus * ki,
  });
  const cost = (kb: number, ki: number) => {
    const pw = make(kb, ki);
    let s = 0;
    for (const p of valid) {
      evaluations++;
      const r = simulate({ ...p.load, powder: pw, settings: { ...(p.load.settings ?? {}), dt } });
      const v = r.ok ? r.muzzleVelocity : 0;
      s += (v - p.velocity) ** 2;
    }
    return s / Math.max(1, valid.length);
  };

  if (valid.length === 0) {
    return { ok: false, message: 'No valid measurements.', powder, burnRateFactor: 1, impetusFactor: 1, rms: NaN, rows: [], evaluations };
  }
  const distinct = new Set(valid.map((p) => p.load.chargeGr)).size;
  if (mode === 'burnRate+impetus' && distinct < 2) mode = 'burnRate';

  let kb = 1;
  let ki = 1;
  if (mode === 'burnRate') {
    kb = Math.exp(golden((u) => cost(Math.exp(u), 1), Math.log(0.2), Math.log(5), 1e-4));
  } else {
    const [u, k] = nelderMead(
      ([u, k]) => (k < 0.8 || k > 1.2 ? 1e12 : cost(Math.exp(u), k)),
      [0, 1],
      [0.3, 0.05],
      120,
    );
    kb = Math.exp(u);
    ki = k;
  }

  const tuned: Powder = {
    ...make(kb, ki),
    id: `${powder.id}-cal-${Date.now().toString(36)}`,
    name: `${powder.name.replace(/\s*\(calibrated.*\)$/, '')} (calibrated)`,
    source: 'calibrated',
    calibratedFrom: powder.id,
  };
  const rows = valid.map((p) => {
    const r = simulate({ ...p.load, powder: tuned });
    return { chargeGr: p.load.chargeGr, measured: p.velocity, predicted: r.muzzleVelocity, maxPressure: r.maxPressure };
  });
  const rms = Math.sqrt(rows.reduce((a, r) => a + (r.predicted - r.measured) ** 2, 0) / rows.length);
  const edge = kb < 0.21 || kb > 4.8;
  return {
    ok: Number.isFinite(rms) && !edge,
    message: edge
      ? 'Fit hit the search limit — the base powder is probably far off, or the measurements are inconsistent.'
      : `Fitted ${mode === 'burnRate' ? 'burn rate' : 'burn rate and impetus'} to ${valid.length} point(s).`,
    powder: tuned,
    burnRateFactor: kb,
    impetusFactor: ki,
    rms,
    rows,
    evaluations,
  };
}

/** Golden-section minimisation of a unimodal function on [a, b]. */
export function golden(f: (x: number) => number, a: number, b: number, tol = 1e-5): number {
  const g = (Math.sqrt(5) - 1) / 2;
  let c = b - g * (b - a);
  let d = a + g * (b - a);
  let fc = f(c);
  let fd = f(d);
  while (Math.abs(b - a) > tol) {
    if (fc < fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - g * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + g * (b - a);
      fd = f(d);
    }
  }
  return 0.5 * (a + b);
}

/** Basic Nelder–Mead simplex minimiser. */
export function nelderMead(f: (x: number[]) => number, x0: number[], step: number[], maxIter = 200): number[] {
  const n = x0.length;
  let simplex: { x: number[]; f: number }[] = [{ x: x0.slice(), f: f(x0) }];
  for (let i = 0; i < n; i++) {
    const x = x0.slice();
    x[i] += step[i];
    simplex.push({ x, f: f(x) });
  }
  for (let it = 0; it < maxIter; it++) {
    simplex.sort((a, b) => a.f - b.f);
    if (Math.abs(simplex[n].f - simplex[0].f) < 1e-6 * (1 + Math.abs(simplex[0].f))) break;
    const centroid = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) centroid[j] += simplex[i].x[j] / n;
    const worst = simplex[n];
    const pt = (t: number) => centroid.map((c, j) => c + t * (worst.x[j] - c));
    const xr = pt(-1);
    const fr = f(xr);
    if (fr < simplex[0].f) {
      const xe = pt(-2);
      const fe = f(xe);
      simplex[n] = fe < fr ? { x: xe, f: fe } : { x: xr, f: fr };
    } else if (fr < simplex[n - 1].f) {
      simplex[n] = { x: xr, f: fr };
    } else {
      const xc = pt(0.5);
      const fc = f(xc);
      if (fc < worst.f) simplex[n] = { x: xc, f: fc };
      else {
        const best = simplex[0].x;
        simplex = simplex.map((s, i) => {
          if (i === 0) return s;
          const x = s.x.map((v, j) => best[j] + 0.5 * (v - best[j]));
          return { x, f: f(x) };
        });
      }
    }
  }
  simplex.sort((a, b) => a.f - b.f);
  return simplex[0].x;
}
