import { calibratePowder, type CalibrationMode, type CalibrationResult } from '../../core/calibrate';
import { simulate } from '../../core/model';
import { shotStats } from '../../core/stats';
import { store } from '../../store/storage';
import { h, clear, fmt, round, numberField, selectField, toast } from '../dom';
import { lineChart } from '../chart';
import { currentLoad, last, setLast, units } from '../ctx';
import { loadForm, settingsForm } from './simulate';

interface Point {
  chargeGr: number;
  velocity: number; // m/s
}

let points: Point[] = [];
let mode: CalibrationMode = 'burnRate';
let lastResult: CalibrationResult | null = null;

export function CalibrateView() {
  const out = h('div', { class: 'results' });
  const list = h('div', { class: 'points' });

  const drawPoints = () => {
    clear(list);
    const u = units();
    points.forEach((p, i) => {
      list.append(
        h(
          'div',
          { class: 'point-row' },
          numberField({ label: 'Charge', unit: 'gr', value: p.chargeGr, step: 0.1, onInput: (v) => (points[i].chargeGr = v) }),
          numberField({ label: 'Measured mean velocity', unit: u.velocity.unit, value: round(u.velocity.from(p.velocity), 0), step: 1, onInput: (v) => (points[i].velocity = u.velocity.to(v)) }),
          h('button', { class: 'btn icon', title: 'Remove', 'aria-label': 'Remove measurement', onClick: () => (points.splice(i, 1), drawPoints()) }, '×'),
        ),
      );
    });
    if (!points.length) list.append(h('p', { class: 'muted' }, 'Add at least one chronograph measurement. Three or more charges give a much better fit.'));
  };

  const fromJournal = () => {
    const l = last();
    const entries = store.get().journal.filter((e) => e.cartridgeId === l.cartridgeId && e.bulletId === l.bulletId && e.powderId === l.powderId && e.velocities.length);
    if (!entries.length) {
      toast('No journal entries with velocities for this cartridge, bullet and powder.');
      return;
    }
    points = entries.map((e) => ({ chargeGr: e.chargeGr, velocity: shotStats(e.velocities).mean }));
    const e0 = entries[0];
    setLast({ coal: e0.coal, barrelLength: e0.barrelLength });
    drawPoints();
    toast(`Imported ${entries.length} journal entr${entries.length === 1 ? 'y' : 'ies'}.`);
  };

  const showResult = (res: CalibrationResult) => {
    const u = units();
    const nameInput = h('input', { type: 'text', class: 'grow', 'aria-label': 'Name for the calibrated powder', value: res.powder.name });
    clear(out);
    out.append(
      h('div', { class: `callout ${res.ok ? '' : 'status-warn'}` }, res.message),
      h(
        'div',
        { class: 'kpis' },
        h('div', { class: 'kpi' }, h('div', { class: 'kpi-label' }, 'RMS velocity error'), h('div', { class: 'kpi-value' }, fmt(u.velocity.from(res.rms), 1), h('span', { class: 'kpi-unit' }, u.velocity.unit))),
        h('div', { class: 'kpi' }, h('div', { class: 'kpi-label' }, 'Burn-rate factor'), h('div', { class: 'kpi-value' }, fmt(res.burnRateFactor, 3), h('span', { class: 'kpi-unit' }, '×'))),
        h('div', { class: 'kpi' }, h('div', { class: 'kpi-label' }, 'Impetus factor'), h('div', { class: 'kpi-value' }, fmt(res.impetusFactor, 3), h('span', { class: 'kpi-unit' }, '×'))),
      ),
    );
    const load = currentLoad();
    const charges = res.rows.map((r) => r.chargeGr);
    const lo = Math.min(...charges) - 1;
    const hi = Math.max(...charges) + 1;
    const curve: [number, number][] = [];
    const curveP: [number, number][] = [];
    for (let c = lo; c <= hi + 1e-9; c += (hi - lo) / 16) {
      const r = simulate({ ...load, powder: res.powder, chargeGr: c });
      if (r.ok) {
        curve.push([c, u.velocity.from(r.muzzleVelocity)]);
        curveP.push([c, u.pressure.from(r.maxPressure)]);
      }
    }
    out.append(
      h(
        'div',
        { class: 'charts' },
        lineChart({
          title: 'Measured vs calibrated model',
          xLabel: 'Charge (gr)',
          yLabel: `Velocity (${u.velocity.unit})`,
          series: [
            { name: 'Calibrated model', color: 'var(--series-1)', points: curve },
            { name: 'Measured', color: 'var(--series-2)', points: res.rows.map((r) => [r.chargeGr, u.velocity.from(r.measured)]), markersOnly: true },
          ],
          xFmt: (v) => fmt(v, 1),
          yFmt: (v) => fmt(v, 0),
          yMin: Math.floor(Math.min(...curve.map((p) => p[1])) * 0.97),
          height: 240,
        }),
        lineChart({
          title: 'Predicted max pressure (calibrated)',
          xLabel: 'Charge (gr)',
          yLabel: `Pressure (${u.pressure.unit})`,
          series: [{ name: 'Max pressure', color: 'var(--series-1)', points: curveP }],
          refLines: [{ y: u.pressure.from(load.cartridge.maxPressureMPa), label: 'Cartridge max' }],
          xFmt: (v) => fmt(v, 1),
          yFmt: (v) => fmt(v, 0),
          height: 240,
        }),
      ),
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'data' },
          h('thead', null, h('tr', null, ['Charge (gr)', `Measured (${u.velocity.unit})`, `Predicted (${u.velocity.unit})`, 'Difference', `Predicted max (${u.pressure.unit})`].map((t) => h('th', null, t)))),
          h(
            'tbody',
            null,
            res.rows.map((r) =>
              h(
                'tr',
                null,
                h('td', null, fmt(r.chargeGr, 1)),
                h('td', null, fmt(u.velocity.from(r.measured), 0)),
                h('td', null, fmt(u.velocity.from(r.predicted), 0)),
                h('td', null, fmt(u.velocity.from(r.predicted) - u.velocity.from(r.measured), 0)),
                h('td', null, fmt(u.pressure.from(r.maxPressure), 0)),
              ),
            ),
          ),
        ),
      ),
      h(
        'p',
        { class: 'note warn' },
        'Velocity agreement does not prove pressure agreement. A model can match your velocities and still be wrong about pressure. Keep watching for pressure signs.',
      ),
      h(
        'div',
        { class: 'actions' },
        nameInput,
        h(
          'button',
          {
            class: 'btn primary',
            onClick: () => {
              const name = nameInput.value.trim();
              if (!name) return toast('Give the powder a name.');
              const pw = { ...res.powder, name, notes: `Calibrated ${new Date().toISOString().slice(0, 10)} against ${res.rows.length} measurement(s), RMS ${res.rms.toFixed(1)} m/s. ${res.powder.notes ?? ''}`.trim() };
              store.upsert('powders', pw);
              setLast({ powderId: pw.id });
              toast('Saved to library and selected.');
            },
          },
          'Save calibrated powder',
        ),
      ),
    );
  };

  const run = () => {
    const valid = points.filter((p) => p.chargeGr > 0 && p.velocity > 0);
    if (!valid.length) {
      toast('Add measurements first.');
      return;
    }
    clear(out);
    out.append(h('p', { class: 'muted' }, 'Fitting…'));
    setTimeout(() => {
      const load = currentLoad();
      const { powder, ...rest } = load;
      lastResult = calibratePowder(powder, valid.map((p) => ({ load: { ...rest, chargeGr: p.chargeGr }, velocity: p.velocity })), mode);
      showResult(lastResult);
    }, 30);
  };

  drawPoints();
  if (lastResult) showResult(lastResult);
  else
    out.append(
      h('div', { class: 'callout' }, h('b', null, 'How calibration works. '), 'Pick the cartridge, bullet, base powder, COAL and barrel you shot with. Enter the mean chronograph velocity for each charge you fired. The fit adjusts the powder model so its velocities match yours, and saves the result as a new powder in your library.'),
    );

  return h(
    'div',
    { class: 'layout' },
    h(
      'aside',
      { class: 'panel' },
      h('h2', null, 'Rifle & base powder'),
      loadForm(() => {}, { showCharge: false }),
      h('h2', null, 'Measurements'),
      list,
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn', onClick: () => (points.push({ chargeGr: points.at(-1)?.chargeGr ?? last().chargeGr, velocity: points.at(-1)?.velocity ?? 0 }), drawPoints()) }, '+ Add measurement'),
        h('button', { class: 'btn', onClick: fromJournal }, 'Import from journal'),
      ),
      selectField(
        'Fit',
        [
          { value: 'burnRate', label: 'Burn rate only (1+ measurements)' },
          { value: 'burnRate+impetus', label: 'Burn rate + impetus (2+ charges)' },
        ],
        mode,
        (v) => (mode = v as CalibrationMode),
      ),
      h('button', { class: 'btn primary wide', onClick: run }, 'Run calibration'),
      settingsForm(() => {}),
    ),
    out,
  );
}
