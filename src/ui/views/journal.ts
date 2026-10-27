import type { JournalEntry } from '../../core/types';
import { shotStats } from '../../core/stats';
import { store, uid } from '../../store/storage';
import { h, add, clear, fmt, round, numberField, selectField, textField, download, toast } from '../dom';
import { last, setLast, units } from '../ctx';
import { navigate, takeParams } from '../router';

function blank(): JournalEntry {
  const l = last();
  return {
    id: uid('j'),
    date: new Date().toISOString().slice(0, 10),
    title: '',
    rifle: '',
    barrelLength: l.barrelLength,
    cartridgeId: l.cartridgeId,
    bulletId: l.bulletId,
    powderId: l.powderId,
    chargeGr: l.chargeGr,
    coal: l.coal,
    primer: '',
    caseInfo: '',
    velocities: [],
    notes: '',
  };
}

const nameOf = (kind: 'cartridges' | 'bullets' | 'powders', id: string) => store.find(kind, id)?.name ?? `(missing: ${id})`;

export function JournalView() {
  const params = takeParams();
  let draft: JournalEntry = blank();
  if (params.prefill) {
    draft.predicted = params.predicted as JournalEntry['predicted'];
    draft.title = `${nameOf('powders', draft.powderId).replace(/\s*\(.*\)$/, '')} ${draft.chargeGr} gr`;
  }
  const editor = h('div');
  const listEl = h('div', { class: 'results' });

  const drawEditor = () => {
    clear(editor);
    const u = units();
    const d = draft;
    const isEdit = store.get().journal.some((e) => e.id === d.id);
    const velText = d.velocities.map((v) => round(u.velocity.from(v), 1)).join(', ');
    add(editor,
      h('h2', null, isEdit ? 'Edit entry' : 'New entry'),
      h(
        'div',
        { class: 'form-grid' },
        textField('Date', d.date, (v) => (d.date = v), { type: 'date' }),
        textField('Title', d.title, (v) => (d.title = v), { placeholder: 'e.g. Ladder test 1' }),
        textField('Rifle', d.rifle, (v) => (d.rifle = v)),
        numberField({ label: 'Barrel length', unit: u.length.unit, value: round(u.length.from(d.barrelLength), 2), onInput: (v) => (d.barrelLength = u.length.to(v)) }),
        selectField('Cartridge', store.list('cartridges').map((c) => ({ value: c.id, label: c.name })), d.cartridgeId, (v) => (d.cartridgeId = v)),
        selectField('Bullet', store.list('bullets').map((c) => ({ value: c.id, label: c.name })), d.bulletId, (v) => (d.bulletId = v)),
        selectField('Powder', store.list('powders').map((c) => ({ value: c.id, label: c.name })), d.powderId, (v) => (d.powderId = v)),
        numberField({ label: 'Charge', unit: 'gr', value: d.chargeGr, step: 0.1, onInput: (v) => (d.chargeGr = v) }),
        numberField({ label: 'COAL', unit: u.length.unit, value: round(u.length.from(d.coal), u.length.digits), onInput: (v) => (d.coal = u.length.to(v)) }),
        textField('Primer', d.primer, (v) => (d.primer = v)),
        textField('Case (maker, firings)', d.caseInfo, (v) => (d.caseInfo = v)),
        textField(`Velocities (${u.velocity.unit}), separated by commas or spaces`, velText, (v) => {
          d.velocities = v
            .split(/[\s,;]+/)
            .map((x) => parseFloat(x))
            .filter((x) => Number.isFinite(x) && x > 0)
            .map((x) => u.velocity.to(x));
        }, { multiline: true }),
        numberField({ label: 'Group size', unit: 'mm', value: d.groupSize ?? NaN, step: 0.1, onInput: (v) => (d.groupSize = v) }),
        numberField({ label: 'Group distance', unit: 'm', value: d.groupDistance ?? NaN, step: 1, onInput: (v) => (d.groupDistance = v) }),
        numberField({ label: 'Temperature', unit: '°C', value: d.temperature ?? NaN, step: 1, onInput: (v) => (d.temperature = v) }),
        textField('Notes', d.notes, (v) => (d.notes = v), { multiline: true, placeholder: 'Pressure signs, bolt lift, primer appearance…' }),
      ),
      d.predicted
        ? h('p', { class: 'note' }, `Model prediction at logging: ${fmt(u.pressure.from(d.predicted.maxPressure), 0)} ${u.pressure.unit}, ${fmt(u.velocity.from(d.predicted.muzzleVelocity), 0)} ${u.velocity.unit}`)
        : null,
      h(
        'div',
        { class: 'actions' },
        h(
          'button',
          {
            class: 'btn primary',
            onClick: () => {
              store.upsertJournal({ ...d, title: d.title || `${d.chargeGr} gr` });
              toast('Saved.');
              draft = blank();
              drawEditor();
              drawList();
            },
          },
          isEdit ? 'Save changes' : 'Add to journal',
        ),
        isEdit ? h('button', { class: 'btn', onClick: () => ((draft = blank()), drawEditor()) }, 'Cancel') : null,
      ),
    );
  };

  const drawList = () => {
    clear(listEl);
    const u = units();
    const entries = [...store.get().journal].sort((a, b) => b.date.localeCompare(a.date));
    listEl.append(
      h(
        'div',
        { class: 'actions' },
        h('h2', { class: 'grow' }, `Journal (${entries.length})`),
        h(
          'button',
          {
            class: 'btn',
            disabled: !entries.length,
            onClick: () => {
              const head = 'date,title,rifle,barrel_mm,cartridge,bullet,powder,charge_gr,coal_mm,primer,case,n,mean_ms,sd_ms,es_ms,group_mm,distance_m,temp_c,notes';
              const q = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`;
              const rows = entries.map((e) => {
                const s = shotStats(e.velocities);
                return [e.date, q(e.title), q(e.rifle), e.barrelLength, q(nameOf('cartridges', e.cartridgeId)), q(nameOf('bullets', e.bulletId)), q(nameOf('powders', e.powderId)), e.chargeGr, e.coal, q(e.primer), q(e.caseInfo), s.n, s.mean.toFixed(1), s.sd.toFixed(1), s.es.toFixed(1), e.groupSize ?? '', e.groupDistance ?? '', e.temperature ?? '', q(e.notes)].join(',');
              });
              download('openib-journal.csv', [head, ...rows].join('\n'), 'text/csv');
            },
          },
          'Export CSV',
        ),
      ),
    );
    if (!entries.length) {
      listEl.append(h('p', { class: 'empty' }, 'No entries yet. Log loads from the Simulate tab or add one here.'));
      return;
    }
    listEl.append(
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'data' },
          h('thead', null, h('tr', null, ['Date', 'Title', 'Load', 'n', `Mean (${u.velocity.unit})`, 'SD', 'ES', 'Group (mm)', ''].map((t) => h('th', null, t)))),
          h(
            'tbody',
            null,
            entries.map((e) => {
              const s = shotStats(e.velocities);
              return h(
                'tr',
                null,
                h('td', null, e.date),
                h('td', null, e.title, e.notes ? h('div', { class: 'muted small' }, e.notes) : null),
                h('td', null, `${nameOf('cartridges', e.cartridgeId)} · ${nameOf('bullets', e.bulletId)} · ${e.chargeGr} gr ${nameOf('powders', e.powderId)}`),
                h('td', null, s.n || '–'),
                h('td', null, fmt(u.velocity.from(s.mean), 0)),
                h('td', null, fmt(u.velocity.from(s.sd), 1)),
                h('td', null, fmt(u.velocity.from(s.es), 0)),
                h('td', null, e.groupSize ? `${fmt(e.groupSize, 1)}${e.groupDistance ? ` @ ${e.groupDistance} m` : ''}` : '–'),
                h(
                  'td',
                  { class: 'row-actions' },
                  h('button', { class: 'btn small', onClick: () => ((draft = { ...e, velocities: [...e.velocities] }), drawEditor(), editor.scrollIntoView({ behavior: 'smooth' })) }, 'Edit'),
                  h(
                    'button',
                    {
                      class: 'btn small',
                      onClick: () => {
                        setLast({ cartridgeId: e.cartridgeId, bulletId: e.bulletId, powderId: e.powderId, chargeGr: e.chargeGr, coal: e.coal, barrelLength: e.barrelLength });
                        navigate('simulate');
                      },
                    },
                    'Simulate',
                  ),
                  h(
                    'button',
                    {
                      class: 'btn small danger',
                      onClick: (ev: Event) => {
                        const b = ev.currentTarget as HTMLButtonElement;
                        if (b.dataset.confirm) {
                          store.removeJournal(e.id);
                          drawList();
                        } else {
                          b.dataset.confirm = '1';
                          b.textContent = 'Confirm';
                        }
                      },
                    },
                    'Delete',
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  };

  drawEditor();
  drawList();
  return h('div', { class: 'layout' }, h('aside', { class: 'panel' }, editor), listEl);
}
