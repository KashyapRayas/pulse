// Ports StrainScorer.kt: cardiovascular load ("Effort") on a 0–100 log scale from Karvonen %HRR and a zone TRIMP
// (default) or Banister TRIMP. The zone TRIMP uses Edwards' 1–5 weights, but on heart-rate reserve: Edwards (1993)
// set his zones on % of HRmax, so this is "zone TRIMP on %HRR", not Edwards' method. Not ported: denominator fitting
// against the reference app references and the diagnostic trace lines.
//
// Effort is a log of TRIMP, so it is for display only. Ratios and sums of load (ACWR, monotony, CTL/ATL/TSB) run on
// linear TRIMP: `trimpFromEffort` inverts the map.
import type { HrSample } from "./types";

/** Dense gate (≈10 min at 1 Hz). */
export const minReadings = 600;
/** Sparse gate: at least this many samples spanning minSpanSeconds. */
export const minSparseReadings = 20;
export const minSpanSeconds = 600;
export const maxStrain = 100.0;
export const strainScaleMax = 21.0;
/** Edwards ceiling (zone 5 for 24 h = 7200) + 1, so that day maps to exactly maxStrain. */
export const strainDenominator = 7201.0;
export const fallbackSampleMin = 1.0 / 60.0;
export const defaultAge = 30;
export const defaultRestingHR = 60.0;
export const hrmaxMinSamples = 600;
export const hrmaxPercentile = 99.5;
/** Banister TRIMP weighting y = k·e^(b·x): men k 0.64, b 1.92; women k 0.86, b 1.67 (Morton, Fitz-Clarke & Banister 1990). */
export const banisterScale = 0.64;
export const banisterScaleWomen = 0.86;
export const banisterBMen = 1.92;
export const banisterBWomen = 1.67;
/** %HRR treated as no effort under Banister (the one tuned constant). */
export const banisterSedentaryHRR = 0.1;
/** Longest span one reading may be credited with, minutes. */
export const maxSampleGapMin = 2.0;

/** (%HRR threshold, weight), highest first: Edwards' weights on heart-rate reserve (see the header). */
export const edwardsZones: readonly [number, number][] = [
  [90.0, 5],
  [80.0, 4],
  [70.0, 3],
  [60.0, 2],
  [50.0, 1],
];

export type StrainMethod = "edwards" | "banister";

/** the reference app 0–21 → Effort 0–100 (pre-divided ratio, as noop does for bit parity). */
export const effortFromStrainScale = (value: number): number => value * (maxStrain / strainScaleMax);

/** Effort 0–100 → the reference app's 0–21 Day Strain axis. */
export const toStrainScale = (effort: number): number => (effort * strainScaleMax) / maxStrain;

/** Inverse of trimpToStrain on the default denominator: the linear TRIMP an Effort stands for (0 for null or ≤ 0). */
export function trimpFromEffort(effort: number | null | undefined, denominator = strainDenominator): number {
  if (effort == null || !(effort > 0)) return 0.0;
  return Math.exp((effort / maxStrain) * Math.log(denominator)) - 1.0;
}

const isFemale = (sex: string): boolean => sex.toLowerCase().startsWith("f");
const banisterB = (sex: string): number => (isFemale(sex) ? banisterBWomen : banisterBMen);
const banisterK = (sex: string): number => (isFemale(sex) ? banisterScaleWomen : banisterScale);
/** The k that goes with a b: 0.86 with the women's 1.67, else the men's 0.64. */
const kFor = (b: number): number => (b === banisterBWomen ? banisterScaleWomen : banisterScale);

export const banisterDailyCeiling = (b: number, k: number = kFor(b)): number => 24.0 * 60.0 * 1.0 * k * Math.exp(b);

export const banisterBaselineRatePerMinute = (b: number, k: number = kFor(b)): number =>
  k * banisterSedentaryHRR * Math.exp(b * banisterSedentaryHRR);

export const banisterBaseline = (minutes: number, b: number, k: number = kFor(b)): number => banisterBaselineRatePerMinute(b, k) * minutes;

/** The log-map denominator that belongs to a method. */
export function logMapDenominator(method: StrainMethod, sex: string): number {
  if (method === "edwards") return strainDenominator;
  const b = banisterB(sex);
  const k = banisterK(sex);
  return banisterDailyCeiling(b, k) - banisterBaseline(24.0 * 60.0, b, k) + 1.0;
}

/** Tanaka (2001): 208 − 0.7 × age. */
export const tanakaHRmax = (age: number): number => 208.0 - 0.7 * age;

/** Tanaka, the current standard; 220 − age (Fox) overestimates HRmax in younger and underestimates it in older adults. */
export const defaultMaxHR = (age: number = defaultAge): number => tanakaHRmax(age);

/** Linear-interpolated percentile of a sorted array (numpy-style). */
export function percentile(sortedValues: number[], pct: number): number {
  const n = sortedValues.length;
  if (n === 0) return 0.0;
  if (n === 1) return sortedValues[0];
  const position = (pct / 100.0) * (n - 1);
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, n - 1);
  return sortedValues[lower] + (position - lower) * (sortedValues[upper] - sortedValues[lower]);
}

export function estimateHRmax(
  hrHistory: number[],
  age: number | null,
): { hrmax: number; source: "observed" | "tanaka" | "unknown" } {
  const tanaka = age != null ? tanakaHRmax(age) : null;
  if (hrHistory.length >= hrmaxMinSamples) {
    const observed = percentile([...hrHistory].sort((a, b) => a - b), hrmaxPercentile);
    if (tanaka == null || observed >= tanaka) return { hrmax: observed, source: "observed" };
    return { hrmax: tanaka, source: "tanaka" };
  }
  if (tanaka != null) return { hrmax: tanaka, source: "tanaka" };
  return { hrmax: 0.0, source: "unknown" };
}

/** Karvonen %HRR, clamped to [0, 100]. */
export function pctHRR(bpm: number, restingHR: number, hrReserve: number): number {
  const pct = ((bpm - restingHR) / hrReserve) * 100.0;
  return Math.min(100, Math.max(0, pct));
}

/** Edwards zone weight 0–5 from unclamped %HRR. */
export function zoneWeight(bpm: number, restingHR: number, hrReserve: number): number {
  const pct = ((bpm - restingHR) / hrReserve) * 100.0;
  for (const [threshold, weight] of edwardsZones) if (pct >= threshold) return weight;
  return 0;
}

/** Live vs stored Effort for a day: the max, so a read-out never drops; two zeros give +0. */
export function effectiveEffort(live: number | null, stored: number | null): number | null {
  if (live == null) return stored;
  if (stored == null) return live;
  if (live === 0 && stored === 0) return 0.0;
  return Math.max(live, stored);
}

/** Each reading covers the gap to the next, clamped to maxSampleGapMin; the last reuses the gap before it. */
export function sampleDurationsMinutes(hr: HrSample[]): number[] {
  if (hr.length === 0) return [];
  if (hr.length === 1) return [fallbackSampleMin];
  const out: number[] = [];
  for (let i = 0; i < hr.length - 1; i++) {
    const deltaS = Math.abs(hr[i + 1].ts - hr[i].ts);
    out.push(Math.min(deltaS > 0 ? deltaS / 60.0 : fallbackSampleMin, maxSampleGapMin));
  }
  out.push(out[out.length - 1]);
  return out;
}

export function edwardsTRIMP(hr: HrSample[], restingHR: number, hrReserve: number, durations: number[]): number {
  let acc = 0.0;
  for (let i = 0; i < hr.length; i++) acc += zoneWeight(hr[i].bpm, restingHR, hrReserve) * durations[i];
  return acc;
}

/** Credited minutes per Edwards zone: [0] is below zone 1, [1..5] are zones 1–5. Needs hrReserve > 0. */
export function zoneMinutes(hr: HrSample[], restingHR: number, hrReserve: number, durations: number[]): number[] {
  const out = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < hr.length; i++) out[zoneWeight(hr[i].bpm, restingHR, hrReserve)] += durations[i];
  return out;
}

/** `floorRatePerMinute` is subtracted per sample, floored at zero. */
export function banisterTRIMP(
  hr: HrSample[],
  restingHR: number,
  hrReserve: number,
  durations: number[],
  b: number,
  floorRatePerMinute = 0.0,
  k: number = kFor(b),
): number {
  let acc = 0.0;
  for (let i = 0; i < hr.length; i++) {
    const x = pctHRR(hr[i].bpm, restingHR, hrReserve) / 100.0;
    if (x > 0) {
      const rate = x * k * Math.exp(b * x);
      acc += durations[i] * Math.max(rate - floorRatePerMinute, 0.0);
    }
  }
  return acc;
}

/** 100 × ln(TRIMP + 1) / ln(D), rounded to 2 dp. TRIMP ≤ 0 or D ≤ 1 gives 0. */
export function trimpToStrain(trimp: number, denominator = strainDenominator): number {
  if (trimp <= 0) return 0.0;
  if (!(denominator > 1)) return 0.0;
  const scaled = ((maxStrain * Math.log(trimp + 1.0)) / Math.log(denominator)) * 100;
  // Above 2^53 every double is already an integer; NaN passes through.
  const rounded = Math.abs(scaled) < 9007199254740992.0 ? Math.round(scaled) : scaled;
  return rounded / 100.0;
}

/**
 * Effort 0–100 from a time-ordered HR series, or null when there is too little data (fewer than
 * minReadings and not minSparseReadings spanning minSpanSeconds) or maxHR ≤ restingHR.
 */
export function strain(
  hr: HrSample[],
  maxHR: number | null = null,
  restingHR: number = defaultRestingHR,
  method: StrainMethod = "edwards",
  sex = "male",
  denominator: number | null = null,
): number | null {
  const resolvedDenominator = denominator ?? logMapDenominator(method, sex);
  const effMax = maxHR ?? defaultMaxHR();
  let enoughData = false;
  if (hr.length >= minReadings) enoughData = true;
  else if (hr.length >= minSparseReadings) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of hr) {
      lo = Math.min(lo, s.ts);
      hi = Math.max(hi, s.ts);
    }
    enoughData = hi - lo >= minSpanSeconds;
  }
  if (!enoughData || effMax <= restingHR) return null;

  const durations = sampleDurationsMinutes(hr);
  const hrReserve = effMax - restingHR;
  const trimp =
    method === "banister"
      ? banisterTRIMP(hr, restingHR, hrReserve, durations, banisterB(sex), banisterBaselineRatePerMinute(banisterB(sex), banisterK(sex)), banisterK(sex))
      : edwardsTRIMP(hr, restingHR, hrReserve, durations);
  return trimpToStrain(trimp, resolvedDenominator);
}
