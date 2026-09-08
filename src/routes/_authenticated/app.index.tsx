import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { Search, Download, Wand2, Upload, BarChart3, ArrowRight, Activity, Database, CheckCircle2, AlertCircle } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Overview,
});

const trend = Array.from({ length: 14 }, (_, i) => ({
  d: `D${i + 1}`,
  rows: Math.round(800000 + Math.random() * 400000 + i * 30000),
  jobs: 6 + Math.round(Math.random() * 4),
}));

function Overview() {
  const { data: org } = useOrg();
  const { data: counts } = useQuery({
    queryKey: ["counts", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const [sources, jobs, policies, dests] = await Promise.all([
        supabase.from("data_sources").select("id, status", { count: "exact" }).eq("org_id", org!.id),
        supabase.from("extraction_jobs").select("id, status", { count: "exact" }).eq("org_id", org!.id),
        supabase.from("transformation_policies").select("id", { count: "exact" }).eq("org_id", org!.id),
        supabase.from("load_destinations").select("id", { count: "exact" }).eq("org_id", org!.id),
      ]);
      return {
        sources: sources.count ?? 0,
        jobs: jobs.count ?? 0,
        policies: policies.count ?? 0,
        dests: dests.count ?? 0,
        runningJobs: (jobs.data ?? []).filter(j => j.status === "running").length,
      };
    },
  });

  const stats = [
    { label: "Data sources", value: counts?.sources ?? 0, icon: Database, color: "text-chart-1" },
    { label: "Extraction jobs", value: counts?.jobs ?? 0, icon: Download, color: "text-chart-2" },
    { label: "Transform policies", value: counts?.policies ?? 0, icon: Wand2, color: "text-chart-3" },
    { label: "Load destinations", value: counts?.dests ?? 0, icon: Upload, color: "text-chart-4" },
  ];

  const phases = [
    { to: "/app/find", phase: "01 · FIND", title: "Discover sources", desc: "Scan authorized networks", icon: Search },
    { to: "/app/extract", phase: "02 · EXTRACT", title: "Configure jobs", desc: "Schedule extractions", icon: Download },
    { to: "/app/transform", phase: "03 · TRANSFORM", title: "Build policies", desc: "PII, quality, enrichment", icon: Wand2 },
    { to: "/app/load", phase: "04 · LOAD", title: "Deliver data", desc: "Snowflake, BigQuery, S3", icon: Upload },
    { to: "/app/analyze", phase: "05 · ANALYZE", title: "Exec dashboards", desc: "Insights & forecasts", icon: BarChart3 },
  ];

  return (
    <div>
      <PageHeader phase="Overview" title={`Welcome, ${org?.name ?? "team"}`} desc="Real-time view of your end-to-end FETLA pipeline." />
      <div className="space-y-8 p-8">
        <div className="grid gap-4 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card-gradient p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</span>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div className="mt-3 font-display text-3xl font-bold">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card-gradient p-6 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Pipeline throughput</div>
                <h3 className="font-display text-lg font-semibold">Rows processed · last 14 days</h3>
              </div>
              <div className="flex items-center gap-1 text-xs text-success"><Activity className="h-3 w-3" /> Live</div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="d" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="rows" stroke="var(--chart-1)" fill="url(#g1)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card-gradient p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Health</div>
            <h3 className="mb-4 font-display text-lg font-semibold">System status</h3>
            <ul className="space-y-3 text-sm">
              {[
                ["Discovery scanner", "operational", "ok"],
                ["Extract workers", `${counts?.runningJobs ?? 0} running`, "ok"],
                ["Transform engine", "operational", "ok"],
                ["Load destinations", counts?.dests ? "syncing" : "no destinations", counts?.dests ? "ok" : "warn"],
                ["Analytics", "fresh", "ok"],
              ].map(([k, v, s]) => (
                <li key={k} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
                  <span className="flex items-center gap-2">{s === "ok" ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertCircle className="h-4 w-4 text-warning" />}{k}</span>
                  <span className="text-xs text-muted-foreground">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">FETLA pipeline</div>
          <div className="grid gap-4 md:grid-cols-5">
            {phases.map((p) => (
              <Link key={p.to} to={p.to} className="group rounded-xl border border-border bg-card-gradient p-5 transition hover:border-primary/60 hover:shadow-glow">
                <p.icon className="h-5 w-5 text-primary" />
                <div className="mt-3 font-mono text-[10px] tracking-widest text-muted-foreground">{p.phase}</div>
                <div className="mt-1 font-semibold">{p.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{p.desc}</div>
                <ArrowRight className="mt-3 h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
