type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, unknown> & { class?: string; style?: string };

/** Tiny hyperscript helper. on* attributes become event listeners. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k === 'value' && 'value' in el) (el as HTMLInputElement).value = String(v);
      else if (k === 'checked') (el as HTMLInputElement).checked = Boolean(v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el: Element) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function fmt(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return '–';
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function round(v: number, digits: number) {
  const k = 10 ** digits;
  return Math.round(v * k) / k;
}

export interface FieldOpts {
  label: string;
  value: number;
  unit?: string;
  step?: number | 'any';
  min?: number;
  max?: number;
  hint?: string;
  onInput: (v: number) => void;
  id?: string;
}

export function numberField(o: FieldOpts) {
  const id = o.id ?? `f-${Math.random().toString(36).slice(2, 8)}`;
  const input = h('input', {
    id,
    type: 'number',
    inputmode: 'decimal',
    step: o.step ?? 'any',
    min: o.min,
    max: o.max,
    value: Number.isFinite(o.value) ? o.value : '',
    onInput: (e: Event) => {
      const v = parseFloat((e.target as HTMLInputElement).value);
      if (Number.isFinite(v)) o.onInput(v);
    },
  });
  return h(
    'label',
    { class: 'field', for: id },
    h('span', { class: 'field-label' }, o.label),
    h('span', { class: 'field-input' }, input, o.unit ? h('span', { class: 'unit' }, o.unit) : null),
    o.hint ? h('span', { class: 'hint' }, o.hint) : null,
  );
}

export function selectField(label: string, options: { value: string; label: string }[], value: string, onChange: (v: string) => void) {
  const id = `s-${Math.random().toString(36).slice(2, 8)}`;
  const sel = h(
    'select',
    { id, onChange: (e: Event) => onChange((e.target as HTMLSelectElement).value) },
    options.map((o) => h('option', { value: o.value, selected: o.value === value }, o.label)),
  );
  return h('label', { class: 'field', for: id }, h('span', { class: 'field-label' }, label), h('span', { class: 'field-input' }, sel));
}

export function textField(label: string, value: string, onInput: (v: string) => void, opts: { multiline?: boolean; placeholder?: string; type?: string } = {}) {
  const id = `t-${Math.random().toString(36).slice(2, 8)}`;
  const el = opts.multiline
    ? h('textarea', { id, rows: 3, placeholder: opts.placeholder, onInput: (e: Event) => onInput((e.target as HTMLTextAreaElement).value) }, value)
    : h('input', { id, type: opts.type ?? 'text', value, placeholder: opts.placeholder, onInput: (e: Event) => onInput((e.target as HTMLInputElement).value) });
  return h('label', { class: 'field', for: id }, h('span', { class: 'field-label' }, label), h('span', { class: 'field-input' }, el));
}

export function debounce<T extends unknown[]>(fn: (...a: T) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...a: T) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export function download(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 0);
}

export function toast(msg: string) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

/** Appends children, skipping null/false. */
export function add(el: Node, ...children: Child[]) {
  append(el, children);
}
