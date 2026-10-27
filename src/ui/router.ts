export type Tab = 'simulate' | 'ladder' | 'calibrate' | 'journal' | 'library' | 'about';

export const TABS: { id: Tab; label: string }[] = [
  { id: 'simulate', label: 'Simulate' },
  { id: 'ladder', label: 'Charge ladder' },
  { id: 'calibrate', label: 'Calibrate' },
  { id: 'journal', label: 'Journal' },
  { id: 'library', label: 'Library' },
  { id: 'about', label: 'About' },
];

let params: Record<string, unknown> = {};
let handler: ((tab: Tab) => void) | null = null;

export function onNavigate(fn: (tab: Tab) => void) {
  handler = fn;
}

export function navigate(tab: Tab, p: Record<string, unknown> = {}) {
  params = p;
  if (location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`);
  handler?.(tab);
}

/** Returns and clears navigation params. */
export function takeParams(): Record<string, unknown> {
  const p = params;
  params = {};
  return p;
}

export function initialTab(): Tab {
  const t = location.hash.slice(1) as Tab;
  return TABS.some((x) => x.id === t) ? t : 'simulate';
}
