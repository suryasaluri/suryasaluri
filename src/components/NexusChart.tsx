import { useRef, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { Download, FileImage, FileText, Table2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ChartSpec = {
  title?: string;
  type: "bar" | "line" | "area" | "pie" | "composed";
  xKey?: string;
  nameKey?: string;
  valueKey?: string;
  series?: Array<{
    key: string;
    name?: string;
    type?: "bar" | "line" | "area";
    color?: string;
    yAxisId?: "left" | "right";
  }>;
  data: Array<Record<string, string | number>>;
};

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function NexusChart({ spec }: { spec: ChartSpec }) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const safeName = (spec.title || "nexus-chart").replace(/[^a-z0-9-_]+/gi, "_");

  const exportPng = async () => {
    if (!ref.current) return;
    const dataUrl = await toPng(ref.current, { backgroundColor: "#0a1520", pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${safeName}.png`;
    a.click();
  };

  const exportPdf = async () => {
    if (!ref.current) return;
    const dataUrl = await toPng(ref.current, { backgroundColor: "#0a1520", pixelRatio: 2 });
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const img = new Image();
    img.src = dataUrl;
    await new Promise((r) => (img.onload = r));
    const ratio = Math.min((pageW - 60) / img.width, (pageH - 100) / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    pdf.setFillColor(10, 21, 32);
    pdf.rect(0, 0, pageW, pageH, "F");
    pdf.setTextColor(110, 231, 255);
    pdf.setFontSize(10);
    pdf.text("NEXUS AI · Nexus Command", 30, 30);
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.text(spec.title || "Chart Export", 30, 55);
    pdf.addImage(dataUrl, "PNG", 30, 75, w, h);
    pdf.save(`${safeName}.pdf`);
  };

  const exportCsv = () => {
    const rows = spec.data;
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${safeName}.csv`;
    a.click();
  };

  const copyData = async () => {
    await navigator.clipboard.writeText(JSON.stringify(spec.data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const xKey = spec.xKey || "name";
  const series = spec.series || [{ key: spec.valueKey || "value", name: spec.valueKey || "value", type: "bar" as const }];
  const hasRight = series.some((s) => s.yAxisId === "right");

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-card to-background shadow-lg shadow-primary/10">
      {/* Pinned export bar — always one tap away, directly under the answer */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 bg-background/80 px-3 py-2 backdrop-blur-md">
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-primary">Export</div>
          {spec.title && <div className="truncate text-xs font-medium text-foreground/90">{spec.title}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-7 gap-1.5 rounded-full border-primary/40 bg-primary/5 px-3 text-[11px] font-medium hover:bg-primary/15" onClick={exportPng}>
            <FileImage className="h-3.5 w-3.5" /> PNG
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 rounded-full border-primary/40 bg-primary/5 px-3 text-[11px] font-medium hover:bg-primary/15" onClick={exportPdf}>
            <FileText className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 rounded-full border-primary/40 bg-primary/5 px-3 text-[11px] font-medium hover:bg-primary/15" onClick={exportCsv}>
            <Table2 className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 rounded-full border-primary/40 bg-primary/5 px-3 text-[11px] font-medium hover:bg-primary/15" onClick={copyData}>
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Download className="h-3.5 w-3.5" />} {copied ? "Copied" : "JSON"}
          </Button>
        </div>
      </div>
      <div ref={ref} className="bg-[#0a1520] p-4">
        <div className="h-72 w-full">
          <ResponsiveContainer>
            {spec.type === "pie" ? (
              <PieChart>
                <Pie
                  data={spec.data}
                  dataKey={spec.valueKey || "value"}
                  nameKey={spec.nameKey || xKey}
                  innerRadius={50}
                  outerRadius={95}
                  paddingAngle={3}
                  label
                >
                  {spec.data.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#0a1520", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            ) : (
              <ComposedChart data={spec.data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey={xKey} stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis yAxisId="left" stroke="var(--muted-foreground)" fontSize={11} />
                {hasRight && <YAxis yAxisId="right" orientation="right" stroke="var(--muted-foreground)" fontSize={11} />}
                <Tooltip contentStyle={{ background: "#0a1520", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {series.map((s, i) => {
                  const color = s.color || PALETTE[i % PALETTE.length];
                  const t = s.type || (spec.type === "composed" ? "bar" : spec.type);
                  const yId = s.yAxisId || "left";
                  if (t === "line")
                    return <Line key={s.key} yAxisId={yId} type="monotone" dataKey={s.key} name={s.name || s.key} stroke={color} strokeWidth={2.5} dot={{ fill: color, r: 3 }} />;
                  if (t === "area")
                    return <Area key={s.key} yAxisId={yId} type="monotone" dataKey={s.key} name={s.name || s.key} stroke={color} fill={color} fillOpacity={0.25} strokeWidth={2} />;
                  return <Bar key={s.key} yAxisId={yId} dataKey={s.key} name={s.name || s.key} fill={color} radius={[4, 4, 0, 0]} />;
                })}
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export function CsvBlock({ csv }: { csv: string }) {
  const trimmed = csv.trim();
  const rows = trimmed.split("\n").map((r) => r.split(",").map((c) => c.trim()));
  const headers = rows[0] || [];
  const body = rows.slice(1, 6);
  const truncated = rows.length - 1 > 5;

  const download = () => {
    const blob = new Blob([trimmed], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "nexus-export.csv";
    a.click();
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-primary/30 bg-background/40">
      <div className="flex items-center justify-between border-b border-border/60 bg-background/40 px-4 py-2">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-primary">NEXUS · Dataset</div>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs" onClick={download}>
          <Table2 className="h-3 w-3" /> Download CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/40 bg-background/30">
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left font-mono uppercase tracking-wider text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, i) => (
              <tr key={i} className="border-b border-border/20">
                {row.map((c, j) => (
                  <td key={j} className="px-3 py-1.5 font-mono">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {truncated && (
          <div className="border-t border-border/30 px-3 py-1.5 text-[10px] text-muted-foreground">+{rows.length - 1 - 5} more rows · download CSV for full dataset</div>
        )}
      </div>
    </div>
  );
}
