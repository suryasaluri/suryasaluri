import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { Search, ArrowRight, Activity, Database, Brain, FileText, CheckCircle2, AlertCircle, History } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { findApi, type UsageBucket } from "@/lib/findApiClient";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Overview,
});

function UsageColumn({ title, bucket, accent }: { title: string; bucket?: UsageBucket; accent: boolean }) {
  const max = bucket?.byAction[0]?.count || 1;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
        <span className={`font-display text-xl font-bold ${accent ? "text-primary" : ""}`}>{bucket?.totalEvents ?? 0}</span>
      </div>
      {!bucket?.byAction.length ? (
        <div className="text-xs text-muted-foreground">No activity yet.</div>
      ) : (
        <div className="space-y-1.5">
          {bucket.byAction.map((a) => {
            const pct = Math.max(4, Math.round((a.count / max) * 100));
            return (
              <div key={a.action} className="flex items-center gap-2 text-xs">
                <div className="w-28 shrink-0 truncate font-mono text-muted-foreground">{a.action}</div>
                <div className="h-3 flex-1 overflow-hidden rounded bg-secondary/40">
                  <div className={`h-full rounded ${accent ? "bg-primary" : "bg-primary/50"}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="w-6 shrink-0 text-right font-mono">{a.count}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Overview() {
  const { data: org } = useOrg();
  const { data: usage } = useQuery({ queryKey: ["findUsage"], queryFn: findApi.getUsage, enabled: !!org?.id });
  const { data: counts } = useQuery({
    queryKey: ["counts", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const [connections, crawls, classifications, docs] = await Promise.all([
        supabase.from("data_sources").select("id", { count: "exact" }).eq("org_id", org!.id),
        supabase.from("schema_crawls").select("id", { count: "exact" }).eq("org_id", org!.id).eq("status", "completed"),
        supabase.from("domain_classifications").select("id", { count: "exact" }).eq("org_id", org!.id),
        supabase.from("documentation_snapshots").select("id", { count: "exact" }).eq("org_id", org!.id),
      ]);
      return {
        connections: connections.count ?? 0,
        crawls: crawls.count ?? 0,
        classifications: classifications.count ?? 0,
        docs: docs.count ?? 0,
      };
    },
  });

  const stats = [
    { label: "Connections", value: counts?.connections ?? 0, icon: Database, color: "text-chart-1" },
    { label: "Schema crawls", value: counts?.crawls ?? 0, icon: Search, color: "text-chart-2" },
    { label: "Domain classifications", value: counts?.classifications ?? 0, icon: Brain, color: "text-chart-3" },
    { label: "Documentation snapshots", value: counts?.docs ?? 0, icon: FileText, color: "text-chart-4" },
  ];

  return (
    <div>
      <PageHeader
        phase="Overview"
        title={`Welcome, ${org?.name ?? "team"}`}
        desc="Nexus Find — schema & relationship intelligence for a database your team already knows. Connect, crawl, classify, and safely report, all through one microservice."
      />
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

        <Dialog>
          <DialogTrigger asChild>
            <button className="w-full rounded-xl border border-border bg-card-gradient p-6 text-left transition hover:border-primary/60 hover:shadow-glow">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Usage report</div>
                  <h3 className="font-display text-lg font-semibold">Platform activity</h3>
                </div>
                <History className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-4 flex items-end gap-8">
                <div>
                  <div className="font-display text-3xl font-bold">{usage?.total.totalEvents ?? 0}</div>
                  <div className="text-xs text-muted-foreground">total events</div>
                </div>
                <div>
                  <div className="font-display text-3xl font-bold text-primary">{usage?.session.totalEvents ?? 0}</div>
                  <div className="text-xs text-muted-foreground">this session</div>
                </div>
              </div>
              {(usage?.total.byAction.length ?? 0) > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {usage!.total.byAction.slice(0, 4).map((a) => (
                    <span key={a.action} className="rounded-full bg-secondary/40 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">{a.action} · {a.count}</span>
                  ))}
                </div>
              )}
              <div className="mt-4 text-xs text-primary">Click for the full report →</div>
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Usage report</DialogTitle>
              <DialogDescription>Every Find action — connections, crawls, domain classification, documentation, and report runs — recorded as it happens.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 md:grid-cols-2">
              <UsageColumn title="Total usage" bucket={usage?.total} accent={false} />
              <UsageColumn title="This session" bucket={usage?.session} accent />
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card-gradient p-6 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Activity</div>
                <h3 className="font-display text-lg font-semibold">Recent Find activity</h3>
              </div>
              <div className="flex items-center gap-1 text-xs text-success"><Activity className="h-3 w-3" /> Live</div>
            </div>
            {!usage?.total.recent.length ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No activity yet — register a connection to get started.</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {usage.total.recent.map((e, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2">
                    <span className="font-mono text-xs">{e.action}</span>
                    <span className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card-gradient p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Health</div>
            <h3 className="mb-4 font-display text-lg font-semibold">System status</h3>
            <ul className="space-y-3 text-sm">
              {[
                ["Oracle connector", "operational", "ok"],
                ["Schema crawler", `${counts?.crawls ?? 0} completed`, "ok"],
                ["Domain classifier (AI)", "operational", "ok"],
                ["Report engine", "operational", "ok"],
              ].map(([k, v, s]) => (
                <li key={k} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
                  <span className="flex items-center gap-2">{s === "ok" ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertCircle className="h-4 w-4 text-warning" />}{k}</span>
                  <span className="text-xs text-muted-foreground">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Link
          to="/app/find"
          className="group flex items-center justify-between rounded-xl border border-border bg-card-gradient p-6 transition hover:border-primary/60 hover:shadow-glow"
        >
          <div className="flex items-center gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Search className="h-5 w-5" /></div>
            <div>
              <div className="font-mono text-[10px] tracking-widest text-muted-foreground">FIND</div>
              <div className="font-semibold">Schema & relationship intelligence</div>
              <div className="text-xs text-muted-foreground">Connect, crawl, classify, and safely report on a database your team already knows.</div>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
        </Link>
      </div>
    </div>
  );
}
