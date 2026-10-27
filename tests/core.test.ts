import { describe, it, expect } from 'vitest';
import {
  simulate,
  psiOfZ,
  zOfPsi,
  validateForm,
  geometry,
  chargeLadder,
  chargeForPressure,
  calibratePowder,
  shotStats,
  grToKg,
  kgToGr,
  mpaToPsi,
  psiToMpa,
  grH2OToCm3,
  type Cartridge,
  type Bullet,
  type Powder,
  type LoadInput,
} from '../src/core';
import cartridges from '../src/data/cartridges.json';
import bullets from '../src/data/bullets.json';
import powders from '../src/data/powders.json';

const cart = (id: string) => (cartridges as Cartridge[]).find((c) => c.id === id)!;
const bul = (id: string) => (bullets as Bullet[]).find((b) => b.id === id)!;
const pow = (id: string) => (powders as Powder[]).find((p) => p.id === id)!;

const base: LoadInput = {
  cartridge: cart('308-win'),
  bullet: bul('308-168-hpbt'),
  powder: pow('example-sb-medium'),
  chargeGr: 43,
  coal: 71.1,
  barrelLength: 610,
};

describe('units', () => {
  it('round-trips', () => {
    expect(kgToGr(grToKg(43))).toBeCloseTo(43, 10);
    expect(psiToMpa(mpaToPsi(415))).toBeCloseTo(415, 10);
    expect(mpaToPsi(415)).toBeCloseTo(60190, -1);
    expect(grH2OToCm3(56)).toBeCloseTo(3.635, 2);
  });
});

describe('form function', () => {
  const forms = [
    { chi: 1, lambda: 0, mu: 0 },
    { chi: 1.15, lambda: -0.130435, mu: 0 },
    { chi: 3, lambda: -1, mu: 1 / 3 },
  ];
  it('is valid and invertible', () => {
    for (const f of forms) {
      expect(validateForm(f)).toBeNull();
      expect(psiOfZ(1, f)).toBeCloseTo(1, 4);
      for (const psi of [0.01, 0.3, 0.7, 0.99]) expect(psiOfZ(zOfPsi(psi, f), f)).toBeCloseTo(psi, 6);
    }
  });
  it('rejects bad forms', () => {
    expect(validateForm({ chi: 1.2, lambda: 0, mu: 0 })).not.toBeNull();
    expect(validateForm({ chi: 2.5, lambda: -0.6, mu: 0 })).not.toBeNull(); // non-monotonic
  });
});

describe('geometry', () => {
  it('computes seating depth and travel', () => {
    const g = geometry(base);
    expect(g.seatingDepth).toBeCloseTo(31.2 - (71.1 - 51.18), 6);
    expect(g.travel).toBeCloseTo((610 - (71.1 - 31.2)) / 1000, 6);
    expect(g.v0).toBeLessThan(g.caseVolume);
  });
});

describe('simulate', () => {
  it('gives a plausible reference result', () => {
    const r = simulate(base);
    expect(r.ok).toBe(true);
    expect(r.maxPressure).toBeGreaterThan(250);
    expect(r.maxPressure).toBeLessThan(450);
    expect(r.muzzleVelocity).toBeGreaterThan(700);
    expect(r.muzzleVelocity).toBeLessThan(900);
    expect(r.efficiency).toBeGreaterThan(0.15);
    expect(r.efficiency).toBeLessThan(0.45);
    expect(r.barrelTime).toBeGreaterThan(0.0007);
    expect(r.barrelTime).toBeLessThan(0.002);
  });

  it('is monotonic in charge', () => {
    const rows = chargeLadder(base, 38, 46, 1);
    expect(rows).toHaveLength(9);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].result.maxPressure).toBeGreaterThan(rows[i - 1].result.maxPressure);
      expect(rows[i].result.muzzleVelocity).toBeGreaterThan(rows[i - 1].result.muzzleVelocity);
    }
  });

  it('pressure rises when the bullet is seated deeper', () => {
    const long = simulate({ ...base, coal: 72 });
    const short = simulate({ ...base, coal: 69 });
    expect(short.maxPressure).toBeGreaterThan(long.maxPressure);
  });

  it('longer barrel gives more velocity', () => {
    const a = simulate({ ...base, barrelLength: 500 });
    const b = simulate({ ...base, barrelLength: 700 });
    expect(b.muzzleVelocity).toBeGreaterThan(a.muzzleVelocity);
    expect(Math.abs(a.maxPressure - b.maxPressure)).toBeLessThan(1);
  });

  it('converges with time step', () => {
    const a = simulate({ ...base, settings: { dt: 1e-7 } });
    const b = simulate({ ...base, settings: { dt: 2.5e-8 } });
    expect(Math.abs(a.maxPressure - b.maxPressure) / b.maxPressure).toBeLessThan(0.003);
    expect(Math.abs(a.muzzleVelocity - b.muzzleVelocity) / b.muzzleVelocity).toBeLessThan(0.002);
  });

  it('matches the analytic adiabatic solution for an instantly burnt charge', () => {
    const p: Powder = { ...base.powder, burnRate: 1e7, pressureExponent: 0 };
    const input: LoadInput = {
      ...base,
      powder: p,
      chargeGr: 30,
      settings: { shotStartPressure: 0, boreResistance: 0, heatLoss: 0, primerPressure: 0.001, dt: 2e-8 },
    };
    const r = simulate(input);
    const g = geometry(input);
    const w = grToKg(30);
    const m = grToKg(base.bullet.massGr);
    const theta = p.gamma - 1;
    const v0f = g.v0 - p.covolume * w;
    const v1f = v0f + g.area * g.travel;
    const U0 = (p.impetus * w) / theta;
    const ke = U0 * (1 - Math.pow(v0f / v1f, theta));
    const v = Math.sqrt((2 * ke) / (m * (1 + w / (3 * m))));
    expect(r.muzzleVelocity).toBeCloseTo(v, -1); // within ~5 m/s
    expect(Math.abs(r.muzzleVelocity - v) / v).toBeLessThan(0.005);
  });

  it('flags overpressure', () => {
    const r = simulate({ ...base, chargeGr: 47 });
    expect(r.pressureRatio).toBeGreaterThan(1);
    expect(r.warnings[0]).toMatch(/EXCEEDS/);
  });

  it('rejects impossible loads', () => {
    expect(simulate({ ...base, coal: 90 }).ok).toBe(false);
    expect(simulate({ ...base, chargeGr: 80 }).ok).toBe(false);
    expect(simulate({ ...base, chargeGr: 0 }).ok).toBe(false);
  });

  it('reports a stuck bullet for a tiny charge', () => {
    const r = simulate({ ...base, chargeGr: 0.3 });
    expect(r.ok).toBe(false);
  });
});

describe('ladder helpers', () => {
  it('finds the charge for a target pressure', () => {
    const c = chargeForPressure(base, 380);
    expect(c).toBeGreaterThan(40);
    expect(c).toBeLessThan(47);
    expect(simulate({ ...base, chargeGr: c }).maxPressure).toBeCloseTo(380, -1);
  });
});

describe('calibration', () => {
  const truth: Powder = { ...base.powder, burnRate: 8.5 * 1.3 };
  const charges = [40, 42, 44];
  const points = charges.map((c) => ({
    load: { ...base, chargeGr: c },
    velocity: simulate({ ...base, powder: truth, chargeGr: c }).muzzleVelocity,
  }));

  it('recovers the burn rate from synthetic data', () => {
    const res = calibratePowder(base.powder, points, 'burnRate');
    expect(res.ok).toBe(true);
    expect(res.burnRateFactor).toBeGreaterThan(1.27);
    expect(res.burnRateFactor).toBeLessThan(1.33);
    expect(res.rms).toBeLessThan(2);
    expect(res.powder.source).toBe('calibrated');
    expect(res.powder.calibratedFrom).toBe(base.powder.id);
  });

  it('fits two parameters', () => {
    const truth2: Powder = { ...base.powder, burnRate: 8.5 * 0.9, impetus: 1.05e6 };
    const pts = [38, 41, 44].map((c) => ({
      load: { ...base, chargeGr: c },
      velocity: simulate({ ...base, powder: truth2, chargeGr: c }).muzzleVelocity,
    }));
    const res = calibratePowder(base.powder, pts, 'burnRate+impetus');
    expect(res.rms).toBeLessThan(3);
  });
});

describe('stats', () => {
  it('computes mean, sd and es', () => {
    const s = shotStats([800, 805, 810]);
    expect(s.mean).toBeCloseTo(805);
    expect(s.sd).toBeCloseTo(5);
    expect(s.es).toBe(10);
    expect(shotStats([]).n).toBe(0);
  });
});
