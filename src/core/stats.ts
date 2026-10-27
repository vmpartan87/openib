export interface ShotStats {
  n: number;
  mean: number;
  sd: number;
  es: number;
  min: number;
  max: number;
}

export function shotStats(values: number[]): ShotStats {
  const v = values.filter((x) => Number.isFinite(x));
  const n = v.length;
  if (n === 0) return { n: 0, mean: NaN, sd: NaN, es: NaN, min: NaN, max: NaN };
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const min = Math.min(...v);
  const max = Math.max(...v);
  return { n, mean, sd, es: max - min, min, max };
}
