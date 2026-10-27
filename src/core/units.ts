/** Unit conversions. Internal solver units are SI. */

export const GRAIN_KG = 64.79891e-6; // 1 grain in kg
export const GRAIN_G = 0.06479891;
/** 1 grain of water (at ~1 g/cm^3) in m^3 */
export const GRAIN_H2O_M3 = GRAIN_KG / 998.2;
export const MM = 1e-3;
export const INCH_MM = 25.4;
export const FPS = 0.3048; // 1 ft/s in m/s
export const PSI_MPA = 0.00689475729;
export const FTLBF_J = 1.3558179483;

export const grToKg = (gr: number) => gr * GRAIN_KG;
export const kgToGr = (kg: number) => kg / GRAIN_KG;
export const grToG = (gr: number) => gr * GRAIN_G;
export const gToGr = (g: number) => g / GRAIN_G;
export const grH2OToM3 = (gr: number) => gr * GRAIN_H2O_M3;
export const grH2OToCm3 = (gr: number) => grH2OToM3(gr) * 1e6;
export const mpaToPsi = (mpa: number) => mpa / PSI_MPA;
export const psiToMpa = (psi: number) => psi * PSI_MPA;
export const msToFps = (ms: number) => ms / FPS;
export const fpsToMs = (fps: number) => fps * FPS;
export const mmToIn = (mm: number) => mm / INCH_MM;
export const inToMm = (inch: number) => inch * INCH_MM;
export const jToFtlbf = (j: number) => j / FTLBF_J;

export type UnitSystem = 'metric' | 'imperial';

export interface UnitFormatter {
  system: UnitSystem;
  length: { unit: string; from: (mm: number) => number; to: (v: number) => number; digits: number };
  velocity: { unit: string; from: (ms: number) => number; to: (v: number) => number; digits: number };
  pressure: { unit: string; from: (mpa: number) => number; to: (v: number) => number; digits: number };
  energy: { unit: string; from: (j: number) => number; digits: number };
}

export function formatter(system: UnitSystem): UnitFormatter {
  if (system === 'imperial') {
    return {
      system,
      length: { unit: 'in', from: mmToIn, to: inToMm, digits: 3 },
      velocity: { unit: 'fps', from: msToFps, to: fpsToMs, digits: 0 },
      pressure: { unit: 'psi', from: mpaToPsi, to: psiToMpa, digits: 0 },
      energy: { unit: 'ft·lbf', from: jToFtlbf, digits: 0 },
    };
  }
  return {
    system,
    length: { unit: 'mm', from: (v) => v, to: (v) => v, digits: 2 },
    velocity: { unit: 'm/s', from: (v) => v, to: (v) => v, digits: 0 },
    pressure: { unit: 'MPa', from: (v) => v, to: (v) => v, digits: 0 },
    energy: { unit: 'J', from: (v) => v, digits: 0 },
  };
}
