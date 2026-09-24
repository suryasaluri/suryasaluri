/** Loosely SQL-identifier-shaped name from arbitrary file/sheet/header text — uppercased, non-word runs collapsed to a single underscore, trimmed of leading/trailing underscores. Falls back to a caller-supplied default when nothing usable survives (e.g. a blank header cell). */
export function sanitizeIdentifier(raw: string, fallback: string): string {
  const cleaned = raw
    .normalize("NFKD")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return cleaned || fallback;
}

/** Appends _2, _3, ... to any name that repeats — a header row with a blank or duplicated cell is common in real exports. */
export function dedupe(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const count = seen.get(n) ?? 0;
    seen.set(n, count + 1);
    return count === 0 ? n : `${n}_${count + 1}`;
  });
}
