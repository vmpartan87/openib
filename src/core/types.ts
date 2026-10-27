/**
 * Core data types. All values stored in the library use "reloader units"
 * (grains, millimetres, grains of water, MPa). The solver converts to SI internally.
 */

export type DataSource = 'illustrative' | 'published' | 'measured' | 'calibrated' | 'user';

export interface Cartridge {
  id: string;
  name: string;
  /** Maximum case length, mm */
  caseLength: number;
  /** Case water capacity to overflow, grains H2O (measure your own brass!) */
  capacityGrH2O: number;
  /** Bore (land) diameter, mm */
  boreDiameter: number;
  /** Groove diameter, mm */
  grooveDiameter: number;
  /** Maximum average pressure, MPa (e.g. C.I.P. Pmax). Used for warnings only. */
  maxPressureMPa: number;
  /** Suggested cartridge overall length, mm */
  defaultCoal: number;
  notes?: string;
  source: DataSource;
}

export interface Bullet {
  id: string;
  name: string;
  /** Bullet diameter, mm */
  diameter: number;
  /** Mass, grains */
  massGr: number;
  /** Overall bullet length, mm */
  length: number;
  notes?: string;
  source: DataSource;
}

/**
 * Geometric form function  psi(Z) = chi * Z * (1 + lambda*Z + mu*Z^2),  Z in [0, 1]
 * where Z is the burnt fraction of the web and psi the burnt fraction of mass.
 * Must satisfy chi * (1 + lambda + mu) = 1.
 */
export interface FormFunction {
  chi: number;
  lambda: number;
  mu: number;
}

export interface Powder {
  id: string;
  name: string;
  kind: 'single-base' | 'double-base' | 'other';
  /** Propellant force / impetus f = R*T0, J/kg */
  impetus: number;
  /** Co-volume (Noble–Abel), m^3/kg */
  covolume: number;
  /** Ratio of specific heats */
  gamma: number;
  /** Solid (grain) density, kg/m^3 */
  density: number;
  /** Bulk (loading) density, kg/m^3 — used for fill ratio only */
  bulkDensity: number;
  /** Adiabatic flame temperature, K (used for gas temperature output) */
  flameTemp: number;
  /** Burn-rate coefficient: dZ/dt = burnRate * (p / 1 MPa)^pressureExponent, 1/s */
  burnRate: number;
  /** Pressure exponent of the burn law */
  pressureExponent: number;
  form: FormFunction;
  notes?: string;
  source: DataSource;
  /** If this powder was derived by calibration: id of the parent powder */
  calibratedFrom?: string;
}

export interface SimulationSettings {
  /** Shot-start (engraving) pressure, MPa */
  shotStartPressure: number;
  /** Constant bore-resistance pressure after engraving, MPa */
  boreResistance: number;
  /** Primer ignition pressure, MPa */
  primerPressure: number;
  /** Fraction of propellant energy lost to the barrel walls (0..0.5) */
  heatLoss: number;
  /** Integration time step, s */
  dt: number;
}

export interface LoadInput {
  cartridge: Cartridge;
  bullet: Bullet;
  powder: Powder;
  /** Powder charge, grains */
  chargeGr: number;
  /** Cartridge overall length, mm */
  coal: number;
  /** Barrel length measured from bolt face, mm */
  barrelLength: number;
  /** Optional override of measured case capacity, grains H2O */
  capacityGrH2O?: number;
  settings?: Partial<SimulationSettings>;
}

export interface TracePoint {
  /** Time, s */
  t: number;
  /** Bullet travel, m */
  x: number;
  /** Velocity, m/s */
  v: number;
  /** Breech (chamber) pressure, MPa */
  pBreech: number;
  /** Base pressure, MPa */
  pBase: number;
  /** Burnt mass fraction */
  psi: number;
}

export interface SimulationResult {
  ok: boolean;
  warnings: string[];
  errors: string[];
  /** Peak chamber (breech) pressure, MPa */
  maxPressure: number;
  /** Time of peak pressure, s */
  maxPressureTime: number;
  /** Bullet travel at peak pressure, m */
  maxPressureTravel: number;
  /** Muzzle velocity, m/s */
  muzzleVelocity: number;
  /** Chamber pressure when the bullet exits, MPa */
  muzzlePressure: number;
  /** Burnt fraction at muzzle */
  burntAtMuzzle: number;
  /** Time from shot start to muzzle exit, s */
  barrelTime: number;
  /** Bullet kinetic energy / chemical energy of charge */
  efficiency: number;
  /** Bullet muzzle energy, J */
  muzzleEnergy: number;
  /** Powder bulk volume / case capacity */
  fillRatio: number;
  /** Initial free volume, cm^3 */
  initialVolume: number;
  /** Bullet travel to muzzle, m */
  travel: number;
  /** Bullet seating depth (below case mouth), mm */
  seatingDepth: number;
  /** Fraction of max pressure relative to cartridge limit */
  pressureRatio: number;
  trace: TracePoint[];
}

export interface Shot {
  velocity: number; // m/s
}

export interface JournalEntry {
  id: string;
  date: string; // ISO date
  title: string;
  rifle: string;
  barrelLength: number; // mm
  cartridgeId: string;
  bulletId: string;
  powderId: string;
  chargeGr: number;
  coal: number; // mm
  primer: string;
  caseInfo: string;
  /** Measured velocities, m/s */
  velocities: number[];
  /** Group size, mm (optional) */
  groupSize?: number;
  /** Distance for group, m */
  groupDistance?: number;
  /** Temperature, °C */
  temperature?: number;
  notes: string;
  /** Predicted values at the time of logging */
  predicted?: { maxPressure: number; muzzleVelocity: number };
}
