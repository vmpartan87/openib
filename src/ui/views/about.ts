import { h } from '../dom';

export const REPO_URL = 'https://github.com/vmpartan87/openib';

export function disclaimerText() {
  return [
    h('p', null, h('b', null, 'OpenIB is a simulation tool, not a source of load data.')),
    h(
      'ul',
      null,
      h('li', null, 'Predicted pressures and velocities come from a simplified physical model. Real pressure can differ a lot from the prediction because of lot-to-lot powder variation, temperature, case and chamber dimensions, bullet construction, primer, throat and bore condition.'),
      h('li', null, 'The bundled powder models are illustrative examples, not real products. They must be calibrated against your own chronograph data before use.'),
      h('li', null, 'Always start from load data published by the powder or bullet manufacturer. Start low, work up in small steps and watch for pressure signs.'),
      h('li', null, 'Excess pressure can destroy a firearm and cause serious injury or death. You are fully responsible for the ammunition you assemble and fire.'),
      h('li', null, 'The software is provided "as is", without warranty of any kind (MIT licence).'),
    ),
  ];
}

export function AboutView() {
  return h(
    'div',
    { class: 'prose' },
    h('h2', null, 'About OpenIB'),
    h('p', null, 'OpenIB is a free, open-source interior ballistics simulator for handloaders. It runs entirely in your browser; nothing is sent to a server.'),
    h('h3', null, 'Safety and disclaimer'),
    ...disclaimerText(),
    h('h3', null, 'The model in brief'),
    h(
      'p',
      null,
      'A lumped-parameter model (as in classic interior ballistics textbooks) integrates powder burning, gas pressure and bullet motion with a 4th-order Runge–Kutta method:',
    ),
    h(
      'ul',
      null,
      h('li', null, 'Burn law: dZ/dt = B · p^n, form function ψ(Z) = χZ(1 + λZ + μZ²)'),
      h('li', null, 'Noble–Abel equation of state with co-volume'),
      h('li', null, 'Energy balance with bullet and gas kinetic energy, bore friction and a lumped heat-loss fraction'),
      h('li', null, 'Lagrange pressure gradient between breech and bullet base'),
      h('li', null, 'Shot-start (engraving) pressure and primer ignition pressure'),
    ),
    h('p', null, 'Full derivation, assumptions and limitations are in docs/MODEL.md in the repository.'),
    h('h3', null, 'Source code'),
    h('p', null, h('a', { href: REPO_URL, target: '_blank', rel: 'noopener' }, REPO_URL), ' — MIT licence. Contributions welcome.'),
  );
}
