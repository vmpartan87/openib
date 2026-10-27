import type { LoadInput, SimulationResult } from '../core/types';
import { formatter } from '../core/units';
import { store, type LastLoad } from '../store/storage';

export const DEFAULT_LAST: LastLoad = {
  cartridgeId: '308-win',
  bulletId: '308-168-hpbt',
  powderId: 'example-sb-medium',
  chargeGr: 43,
  coal: 71.1,
  barrelLength: 610,
};

export function last(): LastLoad {
  const l = { ...DEFAULT_LAST, ...(store.get().last ?? {}) };
  // fall back if a referenced item was deleted
  if (!store.find('cartridges', l.cartridgeId)) l.cartridgeId = DEFAULT_LAST.cartridgeId;
  if (!store.find('bullets', l.bulletId)) l.bulletId = DEFAULT_LAST.bulletId;
  if (!store.find('powders', l.powderId)) l.powderId = DEFAULT_LAST.powderId;
  return l;
}

export function setLast(patch: Partial<LastLoad>) {
  store.update({ last: { ...last(), ...patch } });
}

export function currentLoad(): LoadInput {
  const l = last();
  return {
    cartridge: store.find('cartridges', l.cartridgeId)!,
    bullet: store.find('bullets', l.bulletId)!,
    powder: store.find('powders', l.powderId)!,
    chargeGr: l.chargeGr,
    coal: l.coal,
    barrelLength: l.barrelLength,
    capacityGrH2O: l.capacityGrH2O,
    settings: store.get().settings,
  };
}

export const units = () => formatter(store.get().units);

export type Level = 'ok' | 'warn' | 'danger';
export function pressureLevel(r: Pick<SimulationResult, 'pressureRatio'>): Level {
  if (!Number.isFinite(r.pressureRatio)) return 'warn';
  if (r.pressureRatio > 1) return 'danger';
  if (r.pressureRatio > 0.95) return 'warn';
  return 'ok';
}
export const levelLabel: Record<Level, string> = { ok: 'Below limit', warn: 'Near limit', danger: 'Over limit' };
export const levelIcon: Record<Level, string> = { ok: '●', warn: '▲', danger: '■' };

export const SOURCE_LABEL: Record<string, string> = {
  illustrative: 'Illustrative',
  published: 'Published',
  measured: 'Measured',
  calibrated: 'Calibrated',
  user: 'User',
};
