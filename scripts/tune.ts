// Dev helper: prints predictions for a reference load to tune illustrative powders.
import { simulate } from '../src/core/model';
import carts from '../src/data/cartridges.json';
import bullets from '../src/data/bullets.json';
import powders from '../src/data/powders.json';
import type { Cartridge, Bullet, Powder } from '../src/core/types';

const c = (id: string) => (carts as Cartridge[]).find((x) => x.id === id)!;
const b = (id: string) => (bullets as Bullet[]).find((x) => x.id === id)!;
const p = (id: string) => (powders as Powder[]).find((x) => x.id === id)!;

const cases: [string, string, string, number, number, number][] = [
  ['308-win', '308-168-hpbt', 'example-sb-medium', 43, 71.1, 610],
  ['308-win', '308-168-hpbt', 'example-sb-medium', 45, 71.1, 610],
  ['308-win', '308-168-hpbt', 'example-db-ball', 44, 71.1, 610],
  ['223-rem', '224-55-fmj', 'example-sb-fast', 25, 57.4, 508],
  ['65-creedmoor', '264-140-hpbt', 'example-sb-slow', 41, 71.8, 610],
  ['300-wm', '308-200-hpbt', 'example-sb-slow', 68, 84.8, 660],
];
for (const [cid, bid, pid, ch, coal, bl] of cases) {
  const t0 = performance.now();
  const r = simulate({ cartridge: c(cid), bullet: b(bid), powder: p(pid), chargeGr: ch, coal, barrelLength: bl });
  console.log(cid, pid, ch, 'gr ->', r.ok, 'Pmax', r.maxPressure.toFixed(0), 'MPa', 'v0', r.muzzleVelocity.toFixed(0), 'm/s',
    (r.muzzleVelocity / 0.3048).toFixed(0), 'fps burnt', (r.burntAtMuzzle * 100).toFixed(0), '% fill', (r.fillRatio * 100).toFixed(0),
    'eff', (r.efficiency * 100).toFixed(1), 't', (r.barrelTime * 1e3).toFixed(3), 'ms', (performance.now() - t0).toFixed(0), 'ms cpu', r.warnings, r.errors);
}
