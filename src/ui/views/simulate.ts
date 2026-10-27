import { simulate } from '../../core/model';
import { grToG, grH2OToCm3 } from '../../core/units';
import type { SimulationResult } from '../../core/types';
import { store } from '../../store/storage';
import { h, add, clear, fmt, round, numberField, selectField, debounce, download } from '../dom';
import { lineChart } from '../chart';
import { currentLoad, last, setLast, units, pressureLevel, levelLabel, levelIcon, SOURCE_LABEL } from '../ctx';
import { navigate } from '../router';

export function loadForm(onChange: () => void, opts: { showCharge?: boolean } = {}) {
  const showCharge = opts.showCharge ?? true;
  const wrap = h('div', { class: 'form-grid' });
  const draw = () => {
    clear(wrap);
    const l = last();
    const u = units();
    const cart = store.find('cartridges', l.cartridgeId)!;
    const powder = store.find('powders', l.powderId)!;
    const allBullets = store.list('bullets');
    const matching = allBullets.filter((b) => Math.abs(b.diameter - cart.grooveDiameter) < 0.15);
    const bulletList = matching.length ? matching : allBullets;
    if (!bulletList.some((b) => b.id === l.bulletId) && bulletList.length) setLast({ bulletId: bulletList[0].id });

    const change = (patch: Parameters<typeof setLast>[0], redraw = false) => {
      setLast(patch);
      if (redraw) draw();
      onChange();
    };

    add(wrap,
      selectField('Cartridge', store.list('cartridges').map((c) => ({ value: c.id, label: c.name })), l.cartridgeId, (v) => {
        const c = store.find('cartridges', v)!;
        change({ cartridgeId: v, coal: c.defaultCoal, capacityGrH2O: undefined }, true);
      }),
      numberField({
        label: 'Case capacity',
        unit: 'gr H₂O',
        value: l.capacityGrH2O ?? cart.capacityGrH2O,
        step: 0.1,
        hint: `${fmt(grH2OToCm3(l.capacityGrH2O ?? cart.capacityGrH2O), 2)} cm³ · default ${cart.capacityGrH2O} — weigh your own fired brass`,
        onInput: (v) => change({ capacityGrH2O: v }),
      }),
      selectField('Bullet', bulletList.map((b) => ({ value: b.id, label: b.name })), last().bulletId, (v) => change({ bulletId: v }, true)),
      selectField('Powder', store.list('powders').map((p) => ({ value: p.id, label: p.name })), l.powderId, (v) => change({ powderId: v }, true)),
      powder.source === 'illustrative'
        ? h('p', { class: 'note warn' }, 'This is an illustrative powder model, not a real product. Calibrate it with your chronograph data before trusting any number.')
        : h('p', { class: 'note' }, `Powder data source: ${SOURCE_LABEL[powder.source] ?? powder.source}`),
      showCharge
        ? numberField({
            label: 'Charge',
            unit: 'gr',
            value: l.chargeGr,
            step: 0.1,
            min: 0,
            hint: `${fmt(grToG(l.chargeGr), 3)} g`,
            onInput: (v) => change({ chargeGr: v }),
          })
        : null,
      numberField({
        label: 'Cartridge overall length (COAL)',
        unit: u.length.unit,
        value: round(u.length.from(l.coal), u.length.digits),
        step: u.system === 'metric' ? 0.05 : 0.001,
        hint: `cartridge default ${fmt(u.length.from(cart.defaultCoal), u.length.digits)} ${u.length.unit}`,
        onInput: (v) => change({ coal: u.length.to(v) }),
      }),
      numberField({
        label: 'Barrel length (from bolt face)',
        unit: u.length.unit,
        value: round(u.length.from(l.barrelLength), u.system === 'metric' ? 0 : 2),
        step: u.system === 'metric' ? 1 : 0.25,
        onInput: (v) => change({ barrelLength: u.length.to(v) }),
      }),
    );
  };
  draw();
  return wrap;
}

export function settingsForm(onChange: () => void) {
  const st = store.get().settings;
  const set = (k: keyof typeof st) => (v: number) => {
    store.update({ settings: { ...store.get().settings, [k]: v } });
    onChange();
  };
  return h(
    'details',
    { class: 'advanced' },
    h('summary', null, 'Model settings'),
    h(
      'div',
      { class: 'form-grid' },
      numberField({ label: 'Shot-start pressure', unit: 'MPa', value: st.shotStartPressure, step: 1, hint: 'pressure needed to engrave the bullet', onInput: set('shotStartPressure') }),
      numberField({ label: 'Bore resistance', unit: 'MPa', value: st.boreResistance, step: 0.5, hint: 'friction after engraving', onInput: set('boreResistance') }),
      numberField({ label: 'Primer pressure', unit: 'MPa', value: st.primerPressure, step: 0.5, onInput: set('primerPressure') }),
      numberField({ label: 'Heat loss', unit: 'fraction', value: st.heatLoss, step: 0.01, min: 0, max: 0.5, onInput: set('heatLoss') }),
      numberField({ label: 'Time step', unit: 's', value: st.dt, step: 'any', hint: 'default 1e-7', onInput: (v) => v > 1e-9 && v < 1e-5 && set('dt')(v) }),
    ),
  );
}

export function kpis(r: SimulationResult, limit: number) {
  const u = units();
  const lvl = pressureLevel(r);
  const tile = (label: string, value: string, unit: string, extra?: HTMLElement | null, cls = '') =>
    h('div', { class: `kpi ${cls}` }, h('div', { class: 'kpi-label' }, label), h('div', { class: 'kpi-value' }, value, h('span', { class: 'kpi-unit' }, unit)), extra ?? null);
  return h(
    'div',
    { class: 'kpis' },
    tile(
      'Max chamber pressure',
      fmt(u.pressure.from(r.maxPressure), u.pressure.digits),
      u.pressure.unit,
      h('div', { class: `status status-${lvl}` }, h('span', { 'aria-hidden': 'true' }, levelIcon[lvl]), ` ${levelLabel[lvl]} · ${fmt(r.pressureRatio * 100, 0)} % of ${fmt(u.pressure.from(limit), 0)} ${u.pressure.unit}`),
      'kpi-hero',
    ),
    tile('Muzzle velocity', fmt(u.velocity.from(r.muzzleVelocity), u.velocity.digits), u.velocity.unit, null, 'kpi-hero'),
    tile('Muzzle energy', fmt(u.energy.from(r.muzzleEnergy), 0), u.energy.unit),
    tile('Burnt at muzzle', fmt(r.burntAtMuzzle * 100, 1), '%'),
    tile('Fill ratio', fmt(r.fillRatio * 100, 0), '%'),
    tile('Barrel time', fmt(r.barrelTime * 1000, 3), 'ms'),
    tile('Muzzle pressure', fmt(u.pressure.from(r.muzzlePressure), u.pressure.digits), u.pressure.unit),
    tile('Seating depth', fmt(u.length.from(r.seatingDepth), u.length.digits), u.length.unit),
    tile('Ballistic efficiency', fmt(r.efficiency * 100, 1), '%'),
    tile('Initial free volume', fmt(r.initialVolume, 3), 'cm³'),
  );
}

export function warningsList(r: SimulationResult) {
  const items = [...r.errors.map((e) => ({ t: e, c: 'danger' })), ...r.warnings.map((w) => ({ t: w, c: w.includes('EXCEEDS') ? 'danger' : 'warn' }))];
  if (!items.length) return null;
  return h('ul', { class: 'warnings', role: 'alert' }, items.map((i) => h('li', { class: `status-${i.c}` }, h('span', { 'aria-hidden': 'true' }, i.c === 'danger' ? '■ ' : '▲ '), i.t)));
}

export function SimulateView() {
  const results = h('div', { class: 'results' });
  const run = () => {
    const load = currentLoad();
    const r = simulate(load);
    const u = units();
    clear(results);
    results.append(h('div', { class: 'disclaimer-strip' }, 'Simulation only — not load data. Always start from published load data and work up with care.'));
    const w = warningsList(r);
    if (w) results.append(w);
    if (!r.ok) {
      results.append(h('p', { class: 'empty' }, 'No result for this input.'));
      return;
    }
    results.append(kpis(r, load.cartridge.maxPressureMPa));
    const tStart = r.trace.find((p) => p.v > 0)?.t ?? 0;
    results.append(
      h(
        'div',
        { class: 'charts' },
        lineChart({
          title: 'Chamber pressure vs time',
          xLabel: 'Time from ignition (ms)',
          yLabel: `Pressure (${u.pressure.unit})`,
          series: [{ name: 'Chamber pressure', color: 'var(--series-1)', points: r.trace.map((p) => [p.t * 1000, u.pressure.from(p.pBreech)]) }],
          refLines: [{ y: u.pressure.from(load.cartridge.maxPressureMPa), label: `Cartridge max ${fmt(u.pressure.from(load.cartridge.maxPressureMPa), 0)} ${u.pressure.unit}` }],
          xFmt: (v) => fmt(v, 2),
          yFmt: (v) => fmt(v, 0),
        }),
        lineChart({
          title: 'Bullet velocity vs travel',
          xLabel: `Travel (${u.length.unit})`,
          yLabel: `Velocity (${u.velocity.unit})`,
          series: [{ name: 'Velocity', color: 'var(--series-1)', points: r.trace.filter((p) => p.t >= tStart).map((p) => [u.length.from(p.x * 1000), u.velocity.from(p.v)]) }],
          xFmt: (v) => fmt(v, u.system === 'metric' ? 0 : 1),
          yFmt: (v) => fmt(v, 0),
        }),
      ),
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn primary', onClick: () => navigate('journal', { prefill: true, predicted: { maxPressure: r.maxPressure, muzzleVelocity: r.muzzleVelocity } }) }, 'Log this load in journal'),
        h(
          'button',
          {
            class: 'btn',
            onClick: () => {
              const rows = ['t_ms,travel_mm,velocity_ms,chamber_MPa,base_MPa,burnt_fraction', ...r.trace.map((p) => [p.t * 1000, p.x * 1000, p.v, p.pBreech, p.pBase, p.psi].map((x) => x.toFixed(5)).join(','))];
              download('openib-trace.csv', rows.join('\n'), 'text/csv');
            },
          },
          'Download trace (CSV)',
        ),
      ),
    );
  };
  const rerun = debounce(run, 120);
  const view = h(
    'div',
    { class: 'layout' },
    h('aside', { class: 'panel' }, h('h2', null, 'Load'), loadForm(rerun), settingsForm(rerun)),
    results,
  );
  run();
  return view;
}
