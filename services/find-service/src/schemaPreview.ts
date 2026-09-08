/** Deterministic mock schema preview, seeded from the source's own id/row/table counts. */
export function mockSchemaPreview(source: { id: string; table_count?: number | null; row_count?: number | null }) {
  const seedBase = Array.from(source.id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const tableCount = Math.min(source.table_count ?? 0, 6) || (seedBase % 4) + 1;
  const nouns = ["customers", "orders", "events", "accounts", "invoices", "sessions", "products", "transactions"];
  const columnPool = ["id", "created_at", "updated_at", "email", "name", "amount", "status", "user_id", "metadata"];
  return Array.from({ length: tableCount }, (_, i) => {
    const seed = seedBase + i * 7;
    const rows = Math.max(100, Math.round(((source.row_count ?? 10000) / tableCount) * (0.5 + (seed % 50) / 50)));
    const colCount = 3 + (seed % 5);
    return {
      table: nouns[(seed + i) % nouns.length] + (i > nouns.length - 1 ? `_${i}` : ""),
      rows,
      columns: Array.from({ length: colCount }, (_, j) => columnPool[(seed + j) % columnPool.length]),
    };
  });
}
