import './style.css';
import { store } from './store/storage';
import { h, clear } from './ui/dom';
import { TABS, initialTab, navigate, onNavigate, type Tab } from './ui/router';
import { SimulateView } from './ui/views/simulate';
import { LadderView } from './ui/views/ladder';
import { CalibrateView } from './ui/views/calibrate';
import { JournalView } from './ui/views/journal';
import { LibraryView } from './ui/views/library';
import { AboutView, disclaimerText } from './ui/views/about';

const VIEWS: Record<Tab, () => HTMLElement> = {
  simulate: SimulateView,
  ladder: LadderView,
  calibrate: CalibrateView,
  journal: JournalView,
  library: LibraryView,
  about: AboutView,
};

const app = document.getElementById('app')!;
const main = h('main', { id: 'main' });
let current: Tab = initialTab();

const nav = h('nav', { class: 'tabs', role: 'tablist', 'aria-label': 'Sections' });
const drawNav = () => {
  clear(nav);
  for (const t of TABS)
    nav.append(
      h('button', { role: 'tab', class: `tab${t.id === current ? ' active' : ''}`, 'aria-selected': String(t.id === current), onClick: () => navigate(t.id) }, t.label),
    );
};

const unitToggle = () =>
  h(
    'div',
    { class: 'segmented', role: 'group', 'aria-label': 'Units' },
    (['metric', 'imperial'] as const).map((u) =>
      h(
        'button',
        {
          class: store.get().units === u ? 'active' : '',
          'aria-pressed': String(store.get().units === u),
          onClick: () => {
            store.update({ units: u });
            render();
          },
        },
        u === 'metric' ? 'Metric' : 'Imperial',
      ),
    ),
  );

const header = h('header', { class: 'topbar' });
const drawHeader = () => {
  clear(header);
  header.append(
    h('div', { class: 'brand' }, h('span', { class: 'logo', 'aria-hidden': 'true' }, '◎'), h('span', null, 'OpenIB'), h('span', { class: 'tagline' }, 'interior ballistics for handloaders')),
    unitToggle(),
  );
};

function render() {
  drawHeader();
  drawNav();
  clear(main);
  main.append(VIEWS[current]());
}

onNavigate((t) => {
  current = t;
  render();
  window.scrollTo({ top: 0 });
});
window.addEventListener('hashchange', () => {
  const t = initialTab();
  if (t !== current) navigate(t);
});

app.append(header, nav, main, h('footer', { class: 'footer' }, 'Simulation only — not load data. Use at your own risk. MIT licence.'));
render();

if (!store.get().disclaimerAccepted) {
  const check = h('input', { type: 'checkbox', id: 'accept' });
  const btn = h('button', { class: 'btn primary', disabled: true }, 'Continue');
  check.addEventListener('change', () => (btn.disabled = !check.checked));
  const dlg = h(
    'div',
    { class: 'modal-backdrop' },
    h(
      'div',
      { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-title' },
      h('h2', { id: 'dlg-title' }, 'Before you start'),
      ...disclaimerText(),
      h('label', { class: 'check', for: 'accept' }, check, ' I understand that OpenIB is a simulation and not a source of load data, and I accept full responsibility for its use.'),
      h('div', { class: 'actions' }, btn),
    ),
  );
  btn.addEventListener('click', () => {
    store.update({ disclaimerAccepted: true });
    dlg.remove();
  });
  document.body.append(dlg);
}
