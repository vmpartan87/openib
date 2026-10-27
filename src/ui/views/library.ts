import type { Bullet, Cartridge, Powder } from '../../core/types';
import { validateForm } from '../../core/model';
import { store, uid, type Kind } from '../../store/storage';
import { h, clear, fmt, round, numberField, selectField, textField, download, toast } from '../dom';
import { units, SOURCE_LABEL } from '../ctx';

type AnyItem = Cartridge | Bullet | Powder;
type FieldType = 'text' | 'number' | 'length' | 'pressure' | 'select' | 'textarea';
interface Field {
  key: string;
  label: string;
  type: FieldType;
  unit?: string;
  options?: { value: string; label: string }[];
  hint?: string;
  step?: number;
}

const sourceOpts = Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }));

const FIELDS: Record<Kind, Field[]> = {
  cartridges: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'caseLength', label: 'Case length (max)', type: 'length' },
    { key: 'capacityGrH2O', label: 'Case capacity', type: 'number', unit: 'gr H₂O', step: 0.1 },
    { key: 'boreDiameter', label: 'Bore (land) diameter', type: 'number', unit: 'mm', step: 0.01 },
    { key: 'grooveDiameter', label: 'Groove diameter', type: 'number', unit: 'mm', step: 0.01 },
    { key: 'maxPressureMPa', label: 'Maximum pressure (e.g. C.I.P. Pmax)', type: 'pressure' },
    { key: 'defaultCoal', label: 'Default COAL', type: 'length' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
    { key: 'source', label: 'Data source', type: 'select', options: sourceOpts },
  ],
  bullets: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'diameter', label: 'Diameter', type: 'number', unit: 'mm', step: 0.01 },
    { key: 'massGr', label: 'Mass', type: 'number', unit: 'gr', step: 0.1 },
    { key: 'length', label: 'Length', type: 'length' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
    { key: 'source', label: 'Data source', type: 'select', options: sourceOpts },
  ],
  powders: [
    { key: 'name', label: 'Name', type: 'text' },
    {
      key: 'kind',
      label: 'Type',
      type: 'select',
      options: [
        { value: 'single-base', label: 'Single-base' },
        { value: 'double-base', label: 'Double-base' },
        { value: 'other', label: 'Other' },
      ],
    },
    { key: 'impetus', label: 'Impetus (force) f', type: 'number', unit: 'J/kg', step: 1000 },
    { key: 'covolume', label: 'Co-volume b', type: 'number', unit: 'm³/kg', step: 0.00001 },
    { key: 'gamma', label: 'Ratio of specific heats γ', type: 'number', step: 0.001 },
    { key: 'density', label: 'Grain density', type: 'number', unit: 'kg/m³', step: 1 },
    { key: 'bulkDensity', label: 'Bulk density', type: 'number', unit: 'kg/m³', step: 1, hint: 'for fill ratio only' },
    { key: 'flameTemp', label: 'Flame temperature', type: 'number', unit: 'K', step: 1 },
    { key: 'burnRate', label: 'Burn-rate coefficient B', type: 'number', unit: '1/s at 1 MPa', step: 0.01 },
    { key: 'pressureExponent', label: 'Pressure exponent n', type: 'number', step: 0.01 },
    { key: 'form.chi', label: 'Form function χ', type: 'number', step: 0.001 },
    { key: 'form.lambda', label: 'Form function λ', type: 'number', step: 0.001 },
    { key: 'form.mu', label: 'Form function μ', type: 'number', step: 0.001, hint: 'χ·(1+λ+μ) must equal 1' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
    { key: 'source', label: 'Data source', type: 'select', options: sourceOpts },
  ],
};

const TITLES: Record<Kind, string> = { cartridges: 'Cartridges', bullets: 'Bullets', powders: 'Powders' };

function getPath(o: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((a, k) => (a as Record<string, unknown>)?.[k], o);
}
function setPath(o: Record<string, unknown>, path: string, v: unknown) {
  const ks = path.split('.');
  let cur = o;
  for (let i = 0; i < ks.length - 1; i++) {
    cur[ks[i]] = { ...(cur[ks[i]] as object) };
    cur = cur[ks[i]] as Record<string, unknown>;
  }
  cur[ks[ks.length - 1]] = v;
}

let kind: Kind = 'powders';

export function LibraryView() {
  const body = h('div', { class: 'results' });
  const editor = h('div');

  const edit = (item: AnyItem, isNew: boolean) => {
    const draft = structuredClone(item) as unknown as Record<string, unknown>;
    const u = units();
    clear(editor);
    const fields = FIELDS[kind].map((f) => {
      const val = getPath(draft, f.key);
      const set = (v: unknown) => setPath(draft, f.key, v);
      switch (f.type) {
        case 'text':
          return textField(f.label, String(val ?? ''), set);
        case 'textarea':
          return textField(f.label, String(val ?? ''), set, { multiline: true });
        case 'select':
          return selectField(f.label, f.options!, String(val), set);
        case 'length':
          return numberField({ label: f.label, unit: u.length.unit, value: round(u.length.from(Number(val)), u.length.digits), onInput: (v) => set(u.length.to(v)) });
        case 'pressure':
          return numberField({ label: f.label, unit: u.pressure.unit, value: round(u.pressure.from(Number(val)), 0), onInput: (v) => set(u.pressure.to(v)) });
        default:
          return numberField({ label: f.label, unit: f.unit, value: Number(val), step: f.step, hint: f.hint, onInput: set });
      }
    });
    editor.append(
      h(
        'div',
        { class: 'editor card' },
        h('h3', null, isNew ? `New ${TITLES[kind].toLowerCase().slice(0, -1)}` : `Edit: ${item.name}`),
        h('div', { class: 'form-grid two' }, fields),
        h(
          'div',
          { class: 'actions' },
          h(
            'button',
            {
              class: 'btn primary',
              onClick: () => {
                if (!String(draft.name ?? '').trim()) return toast('Name is required.');
                if (kind === 'powders') {
                  const err = validateForm((draft as unknown as Powder).form);
                  if (err) return toast(err);
                }
                store.upsert(kind, draft as never);
                toast('Saved to your library.');
                clear(editor);
                drawList();
              },
            },
            'Save',
          ),
          h('button', { class: 'btn', onClick: () => clear(editor) }, 'Cancel'),
        ),
      ),
    );
    editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const summary = (it: AnyItem): string => {
    const u = units();
    if (kind === 'cartridges') {
      const c = it as Cartridge;
      return `${c.capacityGrH2O} gr H₂O · groove ${c.grooveDiameter} mm · max ${fmt(u.pressure.from(c.maxPressureMPa), 0)} ${u.pressure.unit}`;
    }
    if (kind === 'bullets') {
      const b = it as Bullet;
      return `${b.massGr} gr · Ø ${b.diameter} mm · ${fmt(u.length.from(b.length), u.length.digits)} ${u.length.unit}`;
    }
    const p = it as Powder;
    return `${p.kind} · f ${fmt(p.impetus / 1000, 0)} kJ/kg · B ${fmt(p.burnRate, 2)} · n ${p.pressureExponent}`;
  };

  const drawList = () => {
    clear(body);
    const items = store.list(kind) as AnyItem[];
    body.append(
      h(
        'div',
        { class: 'subtabs', role: 'tablist' },
        (['powders', 'bullets', 'cartridges'] as Kind[]).map((k) =>
          h('button', { role: 'tab', 'aria-selected': String(k === kind), class: `subtab${k === kind ? ' active' : ''}`, onClick: () => ((kind = k), clear(editor), drawList()) }, TITLES[k]),
        ),
        h('span', { class: 'grow' }),
        h(
          'button',
          {
            class: 'btn primary',
            onClick: () => {
              const tpl = structuredClone(items[0]) as AnyItem;
              edit({ ...tpl, id: uid(kind.slice(0, 1)), name: '', source: 'user', notes: '' } as AnyItem, true);
            },
          },
          '+ New',
        ),
      ),
      editor,
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'data' },
          h('thead', null, h('tr', null, ['Name', 'Details', 'Source', ''].map((t) => h('th', null, t)))),
          h(
            'tbody',
            null,
            items.map((it) => {
              const builtin = store.isBuiltin(kind, it.id);
              return h(
                'tr',
                null,
                h('td', null, it.name, it.notes ? h('div', { class: 'muted small' }, it.notes) : null),
                h('td', { class: 'details' }, summary(it)),
                h('td', null, h('span', { class: `badge src-${it.source}` }, SOURCE_LABEL[it.source] ?? it.source), builtin ? h('span', { class: 'badge' }, 'Built-in') : null),
                h(
                  'td',
                  { class: 'row-actions' },
                  builtin
                    ? h('button', { class: 'btn small', onClick: () => edit({ ...structuredClone(it), id: uid(kind.slice(0, 1)), name: `${it.name} (copy)`, source: 'user' } as AnyItem, true) }, 'Duplicate')
                    : [
                        h('button', { class: 'btn small', onClick: () => edit(it, false) }, 'Edit'),
                        h(
                          'button',
                          {
                            class: 'btn small danger',
                            onClick: (ev: Event) => {
                              const b = ev.currentTarget as HTMLButtonElement;
                              if (b.dataset.confirm) {
                                store.remove(kind, it.id);
                                drawList();
                              } else {
                                b.dataset.confirm = '1';
                                b.textContent = 'Confirm';
                              }
                            },
                          },
                          'Delete',
                        ),
                      ],
                ),
              );
            }),
          ),
        ),
      ),
    );
  };

  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onChange: async (e: Event) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      try {
        const n = store.importJson(await f.text());
        toast(`Imported ${n.powders} powders, ${n.bullets} bullets, ${n.cartridges} cartridges, ${n.journal} journal entries.`);
        drawList();
      } catch (err) {
        toast(`Import failed: ${(err as Error).message}`);
      }
      (e.target as HTMLInputElement).value = '';
    },
  });

  drawList();
  return h(
    'div',
    { class: 'layout' },
    h(
      'aside',
      { class: 'panel' },
      h('h2', null, 'Your data'),
      h('p', { class: 'muted' }, 'Your own items and journal live in this browser only. Export regularly to keep a backup or to move to another device.'),
      h(
        'div',
        { class: 'stack' },
        h('button', { class: 'btn', onClick: () => download(`openib-backup-${new Date().toISOString().slice(0, 10)}.json`, store.exportJson()) }, 'Export library & journal (JSON)'),
        h('button', { class: 'btn', onClick: () => fileInput.click() }, 'Import JSON…'),
        fileInput,
      ),
      h('h2', null, 'Contributing data'),
      h('p', { class: 'muted' }, 'Measured cartridge and bullet data can be contributed to the project as a pull request. See docs/DATA.md in the repository. Powder models must come from your own measurements, never copied from commercial programs.'),
    ),
    body,
  );
}
