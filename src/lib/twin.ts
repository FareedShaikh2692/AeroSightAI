// Digital-twin helpers shared by the 3D viewer and tests.

/** Asset growth: assets start in sequence across the project, each taking ~55% of the overall progress span. */
export function assetFraction(index: number, count: number, pct: number) {
  const start = count > 1 ? (index / (count - 1)) * 0.4 : 0;
  return Math.max(0, Math.min(1, (pct / 100 - start) / 0.55));
}
