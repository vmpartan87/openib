/**
 * Lumped-parameter interior ballistics model.
 *
 *   psi(Z)   = chi*Z*(1 + lambda*Z + mu*Z^2)                         form function
 *   dZ/dt    = B * (p_mean / 1 MPa)^n                                 burn law
 *   V_free   = V0 + A*x - (w/rho)*(1-psi) - b*w*psi                   free gas volume
 *   U        = f_eff*w*psi/theta - KE - A*p_r*x                       gas internal energy
 *   p_mean   = theta * U / V_free                                     Noble–Abel EOS
 *   p_base   = p_mean / (1 + w/(3m)),  p_breech = p_base*(1 + w/(2m)) Lagrange gradient
 *   m dv/dt  = A*(p_base - p_r)
 *
 * See docs/MODEL.md for the derivation and the assumptions.
 */
import type { LoadInput, SimulationResult, SimulationSettings, TracePoint, FormFunction } from './types';
import { grToKg, grH2OToM3, MM } from './units';

export const DEFAULT_SETTINGS: SimulationSettings = {
  shotStartPressure: 30,
  boreResistance: 5,
  primerPressure: 4,
  heatLoss: 0.05,
  dt: 1e-7,
};

const MPA = 1e6;
const MAX_TIME = 0.05; // s
const TRACE_POINTS = 500;

export function psiOfZ(Z: number, f: FormFunction): number {
  if (Z <= 0) return 0;
  if (Z >= 1) return 1;
  const psi = f.chi * Z * (1 + f.lambda * Z + f.mu * Z * Z);
  return Math.min(1, Math.max(0, psi));
}

/** Inverse of psiOfZ by bisection (psi is monotonic on [0,1] for valid form functions). */
export function zOfPsi(psi: number, f: FormFunction): number {
  if (psi <= 0) return 0;
  if (psi >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    if (psiOfZ(mid, f) < psi) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/** Checks that chi*(1+lambda+mu) ≈ 1 and that psi is monotonic on [0,1]. */
export function validateForm(f: FormFunction): string | null {
  const end = f.chi * (1 + f.lambda + f.mu);
  if (Math.abs(end - 1) > 1e-3) return `Form function must satisfy chi·(1+λ+μ)=1 (now ${end.toFixed(4)})`;
  for (let i = 0; i <= 100; i++) {
    const Z = i / 100;
    const d = f.chi * (1 + 2 * f.lambda * Z + 3 * f.mu * Z * Z);
    if (d < -1e-9) return 'Form function is not monotonic on [0,1]';
  }
  return null;
}

export function boreArea(boreDiameterMm: number, grooveDiameterMm: number): number {
  const d = 0.5 * (boreDiameterMm + grooveDiameterMm) * MM;
  return (Math.PI / 4) * d * d;
}

export interface Geometry {
  /** Case volume, m^3 */
  caseVolume: number;
  /** Bullet volume inside the case, m^3 */
  intrusion: number;
  /** Initial empty volume (case − bullet), m^3 */
  v0: number;
  /** Bore area, m^2 */
  area: number;
  /** Travel to muzzle, m */
  travel: number;
  /** Seating depth, mm */
  seatingDepth: number;
}

export function geometry(input: LoadInput): Geometry {
  const { cartridge, bullet, coal, barrelLength } = input;
  const cap = input.capacityGrH2O ?? cartridge.capacityGrH2O;
  const caseVolume = grH2OToM3(cap);
  const seatingDepth = bullet.length - (coal - cartridge.caseLength);
  const dB = bullet.diameter * MM;
  const intrusion = Math.max(0, seatingDepth * MM) * (Math.PI / 4) * dB * dB;
  const area = boreArea(cartridge.boreDiameter, cartridge.grooveDiameter);
  const baseFromBoltFace = (coal - bullet.length) * MM;
  const travel = barrelLength * MM - baseFromBoltFace;
  return { caseVolume, intrusion, v0: caseVolume - intrusion, area, travel, seatingDepth };
}

interface State {
  Z: number;
  x: number;
  v: number;
}

export function simulate(input: LoadInput): SimulationResult {
  const s: SimulationSettings = { ...DEFAULT_SETTINGS, ...(input.settings ?? {}) };
  const { powder, bullet, cartridge } = input;
  const warnings: string[] = [];
  const errors: string[] = [];

  const g = geometry(input);
  const w = grToKg(input.chargeGr);
  const m = grToKg(bullet.massGr);
  const A = g.area;
  const theta = powder.gamma - 1;
  const fEff = powder.impetus * (1 - s.heatLoss);
  const rho = powder.density;
  const b = powder.covolume;
  const B = powder.burnRate;
  const n = powder.pressureExponent;
  const p0 = s.shotStartPressure * MPA;
  const pr = s.boreResistance * MPA;
  const lagMean = 1 + w / (3 * m);
  const lagBreech = 1 + w / (2 * m);

  const fillRatio = w / powder.bulkDensity / g.caseVolume;

  const empty = (): SimulationResult => ({
    ok: false,
    warnings,
    errors,
    maxPressure: NaN,
    maxPressureTime: NaN,
    maxPressureTravel: NaN,
    muzzleVelocity: NaN,
    muzzlePressure: NaN,
    burntAtMuzzle: NaN,
    barrelTime: NaN,
    efficiency: NaN,
    muzzleEnergy: NaN,
    fillRatio,
    initialVolume: g.v0 * 1e6,
    travel: g.travel,
    seatingDepth: g.seatingDepth,
    pressureRatio: NaN,
    trace: [],
  });

  // ---- input validation ----
  const formErr = validateForm(powder.form);
  if (formErr) errors.push(formErr);
  if (!(input.chargeGr > 0)) errors.push('Charge must be positive.');
  if (!(bullet.massGr > 0)) errors.push('Bullet mass must be positive.');
  if (g.seatingDepth < 0) errors.push('Bullet base is outside the case mouth (COAL too long for this bullet).');
  if (g.travel <= 0) errors.push('Barrel is shorter than the cartridge.');
  if (Math.abs(bullet.diameter - cartridge.grooveDiameter) > 0.15)
    warnings.push('Bullet diameter does not match the groove diameter of the cartridge.');
  if (w / rho >= g.v0) errors.push('Solid powder volume exceeds the available case volume — physically impossible load.');
  if (errors.length) return empty();

  if (fillRatio > 1.15) warnings.push(`Very heavily compressed load (fill ${(fillRatio * 100).toFixed(0)} %).`);
  else if (fillRatio > 1.0) warnings.push(`Compressed load (fill ${(fillRatio * 100).toFixed(0)} %).`);
  else if (fillRatio < 0.75) warnings.push(`Low fill ratio (${(fillRatio * 100).toFixed(0)} %) — position sensitivity and erratic ignition likely; the model is less reliable here.`);
  if (g.seatingDepth > 0.9 * bullet.length) warnings.push('Very deep seating.');

  // ---- helper: pressures from state ----
  const pressures = (st: State, moving: boolean) => {
    const psi = psiOfZ(st.Z, powder.form);
    const vFree = g.v0 + A * st.x - (w / rho) * (1 - psi) - b * w * psi;
    const ke = 0.5 * m * st.v * st.v * lagMean;
    const wr = moving ? A * pr * st.x : 0;
    const U = (fEff * w * psi) / theta - ke - wr;
    const pMean = Math.max(0, (theta * U) / vFree);
    const pBase = pMean / lagMean;
    return { psi, pMean, pBase, pBreech: pBase * lagBreech, vFree };
  };

  // ---- primer ignition: initial burnt fraction giving primerPressure ----
  let psi0 = (s.primerPressure * MPA * g.v0) / (fEff * w);
  for (let i = 0; i < 20; i++) {
    const vFree = g.v0 - (w / rho) * (1 - psi0) - b * w * psi0;
    psi0 = (s.primerPressure * MPA * vFree) / (fEff * w);
  }
  psi0 = Math.min(Math.max(psi0, 1e-7), 0.05);

  let st: State = { Z: zOfPsi(psi0, powder.form), x: 0, v: 0 };
  let moving = false;
  let t = 0;
  let tStart = 0;
  const dt = s.dt;

  const deriv = (y: State, mov: boolean): State => {
    const p = pressures(y, mov);
    const dZ = y.Z < 1 ? B * Math.pow(p.pMean / MPA, n) : 0;
    if (!mov) return { Z: dZ, x: 0, v: 0 };
    const acc = (A * (p.pBase - pr)) / m;
    return { Z: dZ, x: y.v, v: y.v <= 0 && acc < 0 ? 0 : acc };
  };
  const add = (a: State, k: State, h: number): State => ({
    Z: Math.min(1, a.Z + k.Z * h),
    x: a.x + k.x * h,
    v: a.v + k.v * h,
  });

  const raw: TracePoint[] = [];
  let maxP = 0;
  let maxPT = 0;
  let maxPX = 0;
  const record = (tt: number, y: State) => {
    const p = pressures(y, moving);
    raw.push({ t: tt, x: y.x, v: y.v, pBreech: p.pBreech / MPA, pBase: p.pBase / MPA, psi: p.psi });
    if (p.pBreech > maxP) {
      maxP = p.pBreech;
      maxPT = tt;
      maxPX = y.x;
    }
  };
  record(0, st);

  let exited = false;
  let steps = 0;
  while (t < MAX_TIME) {
    if (!moving) {
      const p = pressures(st, false);
      if (p.pBase >= p0) {
        moving = true;
        tStart = t;
      }
    }
    // Adaptive step: smaller while pressure rises steeply early on
    const h = dt;
    const k1 = deriv(st, moving);
    const k2 = deriv(add(st, k1, h / 2), moving);
    const k3 = deriv(add(st, k2, h / 2), moving);
    const k4 = deriv(add(st, k3, h), moving);
    const next: State = {
      Z: Math.min(1, st.Z + (h / 6) * (k1.Z + 2 * k2.Z + 2 * k3.Z + k4.Z)),
      x: st.x + (h / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
      v: Math.max(0, st.v + (h / 6) * (k1.v + 2 * k2.v + 2 * k3.v + k4.v)),
    };

    if (next.x >= g.travel) {
      // linear interpolation to the muzzle
      const frac = (g.travel - st.x) / (next.x - st.x);
      const yExit: State = {
        Z: st.Z + frac * (next.Z - st.Z),
        x: g.travel,
        v: st.v + frac * (next.v - st.v),
      };
      t += frac * h;
      record(t, yExit);
      st = yExit;
      exited = true;
      break;
    }
    st = next;
    t += h;
    steps++;
    if (steps % 10 === 0) record(t, st);
    // stuck bullet: moving, pressure gone, velocity zero
    if (moving && st.v === 0 && st.x > 0 && pressures(st, true).pBase < pr) break;
  }

  if (!exited) {
    errors.push('Bullet did not leave the barrel in the simulation (stuck bullet or charge too small).');
    return { ...empty(), trace: thin(raw), maxPressure: maxP / MPA };
  }

  const pExit = pressures(st, true);
  const muzzleEnergy = 0.5 * m * st.v * st.v;
  const chemEnergy = (powder.impetus * w) / theta;
  const result: SimulationResult = {
    ok: true,
    warnings,
    errors,
    maxPressure: maxP / MPA,
    maxPressureTime: maxPT - tStart,
    maxPressureTravel: maxPX,
    muzzleVelocity: st.v,
    muzzlePressure: pExit.pBreech / MPA,
    burntAtMuzzle: pExit.psi,
    barrelTime: t - tStart,
    efficiency: muzzleEnergy / chemEnergy,
    muzzleEnergy,
    fillRatio,
    initialVolume: g.v0 * 1e6,
    travel: g.travel,
    seatingDepth: g.seatingDepth,
    pressureRatio: maxP / MPA / cartridge.maxPressureMPa,
    trace: thin(raw),
  };

  if (result.pressureRatio > 1) warnings.unshift(`PREDICTED PRESSURE EXCEEDS the cartridge maximum (${cartridge.maxPressureMPa} MPa).`);
  else if (result.pressureRatio > 0.95) warnings.unshift('Predicted pressure is within 5 % of the cartridge maximum.');
  if (result.burntAtMuzzle < 0.85) warnings.push(`Only ${(result.burntAtMuzzle * 100).toFixed(0)} % of the powder burns before the muzzle — results are sensitive to model error.`);
  return result;
}

function thin(points: TracePoint[]): TracePoint[] {
  if (points.length <= TRACE_POINTS) return points;
  const step = points.length / TRACE_POINTS;
  const out: TracePoint[] = [];
  for (let i = 0; i < TRACE_POINTS; i++) out.push(points[Math.floor(i * step)]);
  out.push(points[points.length - 1]);
  return out;
}
