import { chargeLadder, chargeForPressure } from '../../core/ladder';
import { h, clear, fmt, numberField, debounce } from '../dom';
import { lineChart } from '../chart';
import { currentLoad, last, units, pressureLevel, levelIcon, levelLabel } from '../ctx';
import { loadForm, settingsForm } from './simulate';

let cfg = { from: NaN, to: NaN, step: 0.5, target: 95 };

export function LadderView() {
  const out = h('div', { class: 'results' });
  if (!Number.isFinite(cfg.from)) {
    const c = last().chargeGr;
    cfg = { ...cfg, from: Math.round((c * 0.9) * 2) / 2, to: Math.round((c * 1.05) * 2) / 2 };
  }

  const run = () => {
    const load = currentLoad();
    const u = units();
    const rows = chargeLadder(load, cfg.from, cfg.to, cfg.step);
    clear(out);
    out.append(h('div', { class: 'disclaimer-strip' }, 'Simulation only — not load data. Predicted pressure can be far from real pressure.'));
    const ok = rows.filter((r) => r.result.ok);
    if (!ok.length) {
      out.append(h('p', { class: 'empty' }, 'No valid results in this range.'));
      return;
    }
    const limit = u.pressure.from(load.cartridge.maxPressureMPa);
    out.append(
      h(
        'div',
        { class: 'charts' },
        lineChart({
          title: 'Max chamber pressure vs charge',
          xLabel: 'Charge (gr)',
          yLabel: `Pressure (${u.pressure.unit})`,
          series: [{ name: 'Max pressure', color: 'var(--series-1)', points: ok.map((r) => [r.chargeGr, u.pressure.from(r.result.maxPressure)]) }],
          refLines: [{ y: limit, label: `Cartridge max ${fmt(limit, 0)} ${u.pressure.unit}` }],
          xFmt: (v) => fmt(v, 1),
          yFmt: (v) => fmt(v, 0),
          height: 220,
        }),
        lineChart({
          title: 'Muzzle velocity vs charge',
          xLabel: 'Charge (gr)',
          yLabel: `Velocity (${u.velocity.unit})`,
          series: [{ name: 'Muzzle velocity', color: 'var(--series-1)', points: ok.map((r) => [r.chargeGr, u.velocity.from(r.result.muzzleVelocity)]) }],
          xFmt: (v) => fmt(v, 1),
          yFmt: (v) => fmt(v, 0),
          yMin: Math.floor(u.velocity.from(Math.min(...ok.map((r) => r.result.muzzleVelocity))) * 0.95),
          height: 220,
        }),
      ),
    );
    out.append(
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'data' },
          h('thead', null, h('tr', null, ['Charge (gr)', `Max pressure (${u.pressure.unit})`, '% of max', `Velocity (${u.velocity.unit})`, 'Burnt %', 'Fill %', 'Barrel time (ms)', 'Status'].map((t) => h('th', null, t)))),
          h(
            'tbody',
            null,
            rows.map((row) => {
              const r = row.result;
              if (!r.ok) return h('tr', null, h('td', null, fmt(row.chargeGr, 1)), h('td', { colspan: 7, class: 'muted' }, r.errors[0] ?? 'No result'));
              const lvl = pressureLevel(r);
              return h(
                'tr',
                { class: `row-${lvl}` },
                h('td', null, fmt(row.chargeGr, 1)),
                h('td', null, fmt(u.pressure.from(r.maxPressure), u.pressure.digits)),
                h('td', null, fmt(r.pressureRatio * 100, 0)),
                h('td', null, fmt(u.velocity.from(r.muzzleVelocity), 0)),
                h('td', null, fmt(r.burntAtMuzzle * 100, 0)),
                h('td', null, fmt(r.fillRatio * 100, 0)),
                h('td', null, fmt(r.barrelTime * 1000, 3)),
                h('td', { class: `status status-${lvl}` }, h('span', { 'aria-hidden': 'true' }, levelIcon[lvl]), ` ${levelLabel[lvl]}`),
              );
            }),
          ),
        ),
      ),
    );
  };
  const rerun = debounce(run, 200);
  const finder = h('div', { class: 'finder' });
  const find = () => {
    const load = currentLoad();
    const target = (load.cartridge.maxPressureMPa * cfg.target) / 100;
    const c = chargeForPressure(load, target);
    const u = units();
    finder.textContent = Number.isFinite(c)
      ? `Model predicts ${fmt(u.pressure.from(target), 0)} ${u.pressure.unit} (${cfg.target} % of max) at about ${fmt(c, 1)} gr. Treat as a model estimate only.`
      : 'Target pressure not reachable in a valid charge range.';
  };

  const view = h(
    'div',
    { class: 'layout' },
    h(
      'aside',
      { class: 'panel' },
      h('h2', null, 'Load'),
      loadForm(rerun, { showCharge: false }),
      h('h2', null, 'Ladder'),
      h(
        'div',
        { class: 'form-grid three' },
        numberField({ label: 'From', unit: 'gr', value: cfg.from, step: 0.1, onInput: (v) => ((cfg.from = v), rerun()) }),
        numberField({ label: 'To', unit: 'gr', value: cfg.to, step: 0.1, onInput: (v) => ((cfg.to = v), rerun()) }),
        numberField({ label: 'Step', unit: 'gr', value: cfg.step, step: 0.1, min: 0.05, onInput: (v) => ((cfg.step = v), rerun()) }),
      ),
      h('h2', null, 'Charge for target pressure'),
      h(
        'div',
        { class: 'form-grid' },
        numberField({ label: 'Target', unit: '% of cartridge max', value: cfg.target, step: 1, min: 50, max: 100, onInput: (v) => (cfg.target = v) }),
        h('button', { class: 'btn', onClick: find }, 'Find charge'),
        finder,
      ),
      settingsForm(rerun),
    ),
    out,
  );
  run();
  return view;
}
