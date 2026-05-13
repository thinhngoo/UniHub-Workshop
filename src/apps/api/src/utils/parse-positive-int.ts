export function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}
