/**
 * Browser persistence (localStorage) for the user's library, journal and settings,
 * plus JSON import/export. Built-in data ships in src/data/*.json and is read-only;
 * user items with the same id override built-ins.
 */
import type { Bullet, Cartridge, JournalEntry, Powder, SimulationSettings } from '../core/types';
import type { UnitSystem } from '../core/units';
import { DEFAULT_SETTINGS } from '../core/model';
import builtinCartridges from '../data/cartridges.json';
import builtinBullets from '../data/bullets.json';
import builtinPowders from '../data/powders.json';

export const FORMAT = 'openib';
export const FORMAT_VERSION = 1;
const KEY = 'openib.v1';

export interface LastLoad {
  cartridgeId: string;
  bulletId: string;
  powderId: string;
  chargeGr: number;
  coal: number;
  barrelLength: number;
  capacityGrH2O?: number;
}

export interface AppState {
  cartridges: Cartridge[];
  bullets: Bullet[];
  powders: Powder[];
  journal: JournalEntry[];
  units: UnitSystem;
  settings: SimulationSettings;
  disclaimerAccepted: boolean;
  last?: LastLoad;
}

export type Kind = 'cartridges' | 'bullets' | 'powders';

export const builtins = {
  cartridges: builtinCartridges as Cartridge[],
  bullets: builtinBullets as Bullet[],
  powders: builtinPowders as Powder[],
};

function empty(): AppState {
  return {
    cartridges: [],
    bullets: [],
    powders: [],
    journal: [],
    units: 'metric',
    settings: { ...DEFAULT_SETTINGS },
    disclaimerAccepted: false,
  };
}

let state: AppState = load();
const listeners = new Set<() => void>();

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw);
    return { ...empty(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) } };
  } catch {
    return empty();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode) – keep in memory */
  }
  listeners.forEach((l) => l());
}

export const store = {
  get: (): AppState => state,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  update(patch: Partial<AppState>) {
    state = { ...state, ...patch };
    save();
  },
  /** Built-ins merged with user items (user wins on id clash). */
  list<K extends Kind>(kind: K): AppState[K] {
    const user = state[kind] as { id: string }[];
    const ids = new Set(user.map((u) => u.id));
    const merged = [...(builtins[kind] as { id: string }[]).filter((b) => !ids.has(b.id)), ...user];
    return merged as AppState[K];
  },
  find<K extends Kind>(kind: K, id: string): AppState[K][number] | undefined {
    return (this.list(kind) as { id: string }[]).find((x) => x.id === id) as AppState[K][number] | undefined;
  },
  isBuiltin(kind: Kind, id: string) {
    return (builtins[kind] as { id: string }[]).some((b) => b.id === id) && !(state[kind] as { id: string }[]).some((u) => u.id === id);
  },
  upsert<K extends Kind>(kind: K, item: AppState[K][number]) {
    const arr = (state[kind] as { id: string }[]).filter((x) => x.id !== (item as { id: string }).id);
    state = { ...state, [kind]: [...arr, item] };
    save();
  },
  remove(kind: Kind, id: string) {
    state = { ...state, [kind]: (state[kind] as { id: string }[]).filter((x) => x.id !== id) };
    save();
  },
  upsertJournal(e: JournalEntry) {
    state = { ...state, journal: [...state.journal.filter((x) => x.id !== e.id), e] };
    save();
  },
  removeJournal(id: string) {
    state = { ...state, journal: state.journal.filter((x) => x.id !== id) };
    save();
  },
  exportJson(): string {
    const { cartridges, bullets, powders, journal } = state;
    return JSON.stringify(
      { format: FORMAT, version: FORMAT_VERSION, exported: new Date().toISOString(), cartridges, bullets, powders, journal },
      null,
      2,
    );
  },
  /** Merges an export file into the current state. Returns counts. */
  importJson(text: string): { cartridges: number; bullets: number; powders: number; journal: number } {
    const data = JSON.parse(text);
    if (data.format !== FORMAT) throw new Error('Not an OpenIB export file.');
    const merge = <T extends { id: string }>(cur: T[], inc: T[] | undefined) => {
      const m = new Map(cur.map((x) => [x.id, x]));
      (inc ?? []).forEach((x) => x && typeof x.id === 'string' && m.set(x.id, x));
      return [...m.values()];
    };
    state = {
      ...state,
      cartridges: merge(state.cartridges, data.cartridges),
      bullets: merge(state.bullets, data.bullets),
      powders: merge(state.powders, data.powders),
      journal: merge(state.journal, data.journal),
    };
    save();
    return {
      cartridges: data.cartridges?.length ?? 0,
      bullets: data.bullets?.length ?? 0,
      powders: data.powders?.length ?? 0,
      journal: data.journal?.length ?? 0,
    };
  },
  reset() {
    state = { ...empty(), disclaimerAccepted: state.disclaimerAccepted };
    save();
  },
};

export function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
