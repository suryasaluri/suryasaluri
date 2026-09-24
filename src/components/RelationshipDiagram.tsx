import type { TableDef, RelationshipEdge } from "@/lib/findApiClient";

const BOX_W = 148;
const BOX_H = 44;
const GAP_X = 56;
const GAP_Y = 40;
const MARGIN = 24;

type Point = { x: number; y: number };

/** Where a line from this box's center toward `toward` crosses the box's own boundary — so an edge terminates at the box edge instead of running under the label. */
function clipToBoxEdge(center: Point, toward: Point): Point {
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  if (dx === 0 && dy === 0) return center;
  const halfW = BOX_W / 2;
  const halfH = BOX_H / 2;
  const scale = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH);
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}

/** Deterministic grid layout — no force/DAG layout library. Tables with more relationships sort earlier, so hub tables land toward the top-left where a reader's eye starts, without needing real graph-layout math. */
function layoutTables(tables: TableDef[], relationships: RelationshipEdge[]): Map<string, Point> {
  const degree = new Map<string, number>();
  for (const t of tables) degree.set(t.name, 0);
  for (const r of relationships) {
    degree.set(r.fromTable, (degree.get(r.fromTable) ?? 0) + 1);
    degree.set(r.toTable, (degree.get(r.toTable) ?? 0) + 1);
  }
  const ordered = [...tables].sort((a, b) => (degree.get(b.name) ?? 0) - (degree.get(a.name) ?? 0) || a.name.localeCompare(b.name));

  const cols = Math.max(1, Math.ceil(Math.sqrt(ordered.length)));
  const positions = new Map<string, Point>();
  ordered.forEach((t, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.set(t.name, {
      x: MARGIN + BOX_W / 2 + col * (BOX_W + GAP_X),
      y: MARGIN + BOX_H / 2 + row * (BOX_H + GAP_Y),
    });
  });
  return positions;
}

export function RelationshipDiagram({
  tables,
  relationships,
  sensitivityByTable,
  onSelectTable,
}: {
  tables: TableDef[];
  relationships: RelationshipEdge[];
  sensitivityByTable?: Record<string, string[]>;
  onSelectTable?: (tableName: string) => void;
}) {
  if (!tables.length) return null;

  const positions = layoutTables(tables, relationships);
  const cols = Math.max(1, Math.ceil(Math.sqrt(tables.length)));
  const rows = Math.ceil(tables.length / cols);
  const width = MARGIN * 2 + cols * BOX_W + (cols - 1) * GAP_X;
  const height = MARGIN * 2 + rows * BOX_H + (rows - 1) * GAP_Y;

  const label = `Relationship diagram: ${tables.length} tables and ${relationships.length} foreign-key edges, tables with more relationships positioned first.`;

  return (
    <figure className="m-0">
      <div className="max-h-[520px] overflow-auto rounded-lg border border-border bg-background/40 p-2">
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: Math.max(width, 480), height: "auto", color: "var(--foreground, currentColor)" }} role="img" aria-label={label}>
          <defs>
            <marker id="rel-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" fill="currentColor" opacity="0.6" />
            </marker>
          </defs>
          {relationships.map((r, i) => {
            const from = positions.get(r.fromTable);
            const to = positions.get(r.toTable);
            if (!from || !to || r.fromTable === r.toTable) return null;
            const start = clipToBoxEdge(from, to);
            const end = clipToBoxEdge(to, from);
            return (
              <line
                key={i}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke="currentColor"
                strokeOpacity={0.35}
                strokeWidth={1.25}
                markerEnd="url(#rel-arrow)"
              />
            );
          })}
          {tables.map((t) => {
            const pos = positions.get(t.name);
            if (!pos) return null;
            const sensitive = (sensitivityByTable?.[t.name] ?? []).length > 0;
            return (
              <g
                key={t.name}
                transform={`translate(${pos.x - BOX_W / 2}, ${pos.y - BOX_H / 2})`}
                style={{ cursor: onSelectTable ? "pointer" : "default" }}
                onClick={() => onSelectTable?.(t.name)}
              >
                <rect width={BOX_W} height={BOX_H} rx={7} fill="var(--card, #1c1915)" stroke="currentColor" strokeOpacity={0.4} strokeWidth={1.2} />
                {sensitive && <circle cx={BOX_W - 10} cy={10} r={3.5} fill="var(--warning, #d8b662)" />}
                <text x={BOX_W / 2} y={BOX_H / 2 + 4} textAnchor="middle" fontSize="10.5" fontFamily="ui-monospace, monospace" fill="currentColor">
                  {t.name.length > 18 ? `${t.name.slice(0, 16)}…` : t.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        {tables.length} tables, {relationships.length} foreign-key relationships{onSelectTable ? " — click a table to jump to it below" : ""}. A gold dot flags a table with at least one sensitive column.
      </figcaption>
    </figure>
  );
}
