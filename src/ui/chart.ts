/**
 * Minimal dependency-free SVG line chart with crosshair tooltip.
 * One y-axis only — plot different quantities in separate charts.
 */
import { h } from './dom';

const NS = 'http://www.w3.org/2000/svg';

export interface Series {
  name: string;
  /** CSS colour (use var(--series-n)) */
  color: string;
  points: [number, number][];
  dashed?: boolean;
  /** draw as markers only (e.g. measurements) */
  markersOnly?: boolean;
}

export interface ChartOpts {
  title: string;
  xLabel: string;
  yLabel: string;
  series: Series[];
  refLines?: { y: number; label: string }[];
  xFmt?: (v: number) => string;
  yFmt?: (v: number) => string;
  height?: number;
  yMin?: number;
}

function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (!(max > min)) return [min];
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const norm = step0 / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 1e-9; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

export function lineChart(o: ChartOpts): HTMLElement {
  const fig = h('figure', { class: 'chart' });
  const legend =
    o.series.length >= 2
      ? h(
          'div',
          { class: 'legend' },
          o.series.map((se) =>
            h('span', { class: 'legend-item' }, h('span', { class: `swatch${se.markersOnly ? ' dot' : se.dashed ? ' dashed' : ''}`, style: `--c:${se.color}` }), se.name),
          ),
        )
      : null;
  fig.append(h('figcaption', null, h('span', { class: 'chart-title' }, o.title), legend));
  const host = h('div', { class: 'chart-host' });
  fig.append(host);

  const render = () => {
    host.innerHTML = '';
    const W = Math.max(280, host.clientWidth || 600);
    const H = o.height ?? 260;
    const m = { l: 56, r: 16, t: 12, b: 40 };
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    const all = o.series.flatMap((se) => se.points);
    if (!all.length) return;
    let xMin = Math.min(...all.map((p) => p[0]));
    let xMax = Math.max(...all.map((p) => p[0]));
    let yMin = o.yMin ?? Math.min(0, ...all.map((p) => p[1]));
    let yMax = Math.max(...all.map((p) => p[1]), ...(o.refLines ?? []).map((r) => r.y));
    if (xMax === xMin) {
      xMax += 1;
      xMin -= 1;
    }
    if (yMax === yMin) yMax = yMin + 1;
    yMax += (yMax - yMin) * 0.06;
    const xt = niceTicks(xMin, xMax, Math.max(3, Math.floor(pw / 90)));
    const yt = niceTicks(yMin, yMax, 5);
    const X = (v: number) => m.l + ((v - xMin) / (xMax - xMin)) * pw;
    const Y = (v: number) => m.t + ph - ((v - yMin) / (yMax - yMin)) * ph;
    const xf = o.xFmt ?? ((v: number) => String(v));
    const yf = o.yFmt ?? ((v: number) => String(v));

    const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': o.title });
    const grid = s('g', { class: 'grid' });
    for (const t of yt) {
      grid.append(s('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t) }));
      const tx = s('text', { x: m.l - 8, y: Y(t) + 4, 'text-anchor': 'end', class: 'tick' });
      tx.textContent = yf(t);
      grid.append(tx);
    }
    for (const t of xt) {
      const tx = s('text', { x: X(t), y: H - m.b + 18, 'text-anchor': 'middle', class: 'tick' });
      tx.textContent = xf(t);
      grid.append(tx);
    }
    grid.append(s('line', { x1: m.l, x2: W - m.r, y1: Y(yMin), y2: Y(yMin), class: 'baseline' }));
    svg.append(grid);
    const xl = s('text', { x: m.l + pw / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis-label' });
    xl.textContent = o.xLabel;
    const yl = s('text', { x: 12, y: m.t + ph / 2, 'text-anchor': 'middle', class: 'axis-label', transform: `rotate(-90 12 ${m.t + ph / 2})` });
    yl.textContent = o.yLabel;
    svg.append(xl, yl);

    for (const r of o.refLines ?? []) {
      svg.append(s('line', { x1: m.l, x2: W - m.r, y1: Y(r.y), y2: Y(r.y), class: 'refline' }));
      const t = s('text', { x: W - m.r - 4, y: Y(r.y) - 6, 'text-anchor': 'end', class: 'ref-label' });
      t.textContent = r.label;
      svg.append(t);
    }

    for (const se of o.series) {
      if (se.markersOnly) {
        for (const [x, y] of se.points) svg.append(s('circle', { cx: X(x), cy: Y(y), r: 4.5, fill: se.color, class: 'marker' }));
      } else {
        const d = se.points.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
        svg.append(s('path', { d, fill: 'none', stroke: se.color, 'stroke-width': 2, 'stroke-dasharray': se.dashed ? '6 4' : 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      }
    }

    // hover layer
    const cross = s('line', { y1: m.t, y2: m.t + ph, class: 'crosshair', visibility: 'hidden' });
    const dots = o.series.map((se) => {
      const c = s('circle', { r: 4.5, fill: se.color, class: 'hover-dot', visibility: 'hidden' });
      return c;
    });
    svg.append(cross, ...dots);
    const tip = h('div', { class: 'tooltip', hidden: true });
    const hit = s('rect', { x: m.l, y: m.t, width: pw, height: ph, fill: 'transparent' });
    const nearest = (pts: [number, number][], x: number) => {
      let best = 0;
      let bd = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const d = Math.abs(pts[i][0] - x);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      return pts[best];
    };
    const move = (ev: PointerEvent) => {
      const rect = svg.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const x = xMin + ((px - m.l) / pw) * (xMax - xMin);
      const rows: HTMLElement[] = [];
      let xv = x;
      o.series.forEach((se, i) => {
        if (!se.points.length) return;
        const p = nearest(se.points, x);
        if (i === 0) xv = p[0];
        dots[i].setAttribute('cx', String(X(p[0])));
        dots[i].setAttribute('cy', String(Y(p[1])));
        dots[i].setAttribute('visibility', 'visible');
        rows.push(h('div', { class: 'tip-row' }, h('span', { class: 'swatch', style: `--c:${se.color}` }), h('span', { class: 'tip-name' }, se.name), h('b', null, yf(p[1]))));
      });
      cross.setAttribute('x1', String(X(xv)));
      cross.setAttribute('x2', String(X(xv)));
      cross.setAttribute('visibility', 'visible');
      tip.replaceChildren(h('div', { class: 'tip-x' }, `${o.xLabel}: ${xf(xv)}`), ...rows);
      tip.hidden = false;
      const left = Math.min(Math.max(X(xv) + 12, 0), W - 180);
      tip.style.left = `${left}px`;
      tip.style.top = `${m.t + 4}px`;
    };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', () => {
      tip.hidden = true;
      cross.setAttribute('visibility', 'hidden');
      dots.forEach((d) => d.setAttribute('visibility', 'hidden'));
    });
    svg.append(hit);
    host.append(svg, tip);
  };

  const ro = new ResizeObserver(() => render());
  ro.observe(host);
  requestAnimationFrame(render);
  return fig;
}
