import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { useState } from "react";
import { toast } from "sonner";
import { Search, ArrowRight, Activity, Database, Brain, FileText, CheckCircle2, AlertCircle, History, Gauge, Coins } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findApi, type UsageBucket, type AiUsageBucket, type AiFeature } from "@/lib/findApiClient";

const AI_FEATURE_LABELS: Record<AiFeature, string> = {
  domain_classification: "Domain classification",
  glossary: "Glossary generation",
  functional_documentation: "Functional documentation",
  copilot: "Copilot Q&A",
  report_nl_parse: "Natural-language reports",
};

function formatUsd(n: number): string {
  if (n === 0) return "$0.00";
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

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

function AiUsageColumn({ title, bucket, accent }: { title: string; bucket?: AiUsageBucket; accent: boolean }) {
  const max = bucket?.byFeature[0]?.costUsd || 1;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
        <span className={`font-display text-xl font-bold ${accent ? "text-primary" : ""}`}>{formatUsd(bucket?.totalCostUsd ?? 0)}</span>
      </div>
      <div className="mb-2 text-xs text-muted-foreground">{(bucket?.totalTokens ?? 0).toLocaleString()} tokens · {bucket?.requestCount ?? 0} requests</div>
      {!bucket?.byFeature.length ? (
        <div className="text-xs text-muted-foreground">No AI usage yet.</div>
      ) : (
        <div className="space-y-1.5">
          {bucket.byFeature.map((f) => {
            const pct = Math.max(4, Math.round((f.costUsd / max) * 100));
            return (
              <div key={f.feature} className="flex items-center gap-2 text-xs">
                <div className="w-32 shrink-0 truncate text-muted-foreground">{AI_FEATURE_LABELS[f.feature] ?? f.feature}</div>
                <div className="h-3 flex-1 overflow-hidden rounded bg-secondary/40">
                  <div className={`h-full rounded ${accent ? "bg-primary" : "bg-primary/50"}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="w-14 shrink-0 text-right font-mono">{formatUsd(f.costUsd)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AiCapSettings({ settings, featureDefaults, minCapTokens }: { settings: { maxOutputTokens: number | null }; featureDefaults: Record<AiFeature, number>; minCapTokens: number }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(settings.maxOutputTokens != null ? String(settings.maxOutputTokens) : "");

  const save = useMutation({
    mutationFn: (maxOutputTokens: number | null) => findApi.updateAiUsageSettings(maxOutputTokens),
    onSuccess: () => {
      toast.success("Per-request cap updated");
      queryClient.invalidateQueries({ queryKey: ["findAiUsage"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't update the cap"),
  });

  const highestDefault = Math.max(...Object.values(featureDefaults));

  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-4">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-medium"><Gauge className="h-3.5 w-3.5 text-primary" /> Cap AI usage per request</div>
      <p className="mb-3 text-xs text-muted-foreground">
        Sets the maximum output tokens Claude can spend on any single AI request (domain classification, glossary, documentation, copilot, or NL report parsing).
        A cap only ever tightens a feature's own tuned limit (up to {highestDefault.toLocaleString()} tokens) — it can't raise it.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="ai-cap" className="mb-1 block text-xs text-muted-foreground">Max output tokens per request</Label>
          <Input
            id="ai-cap"
            type="number"
            min={minCapTokens}
            placeholder="No cap"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-40"
          />
        </div>
        <Button
          size="sm"
          disabled={save.isPending || (value !== "" && Number(value) < minCapTokens)}
          onClick={() => save.mutate(value === "" ? null : Number(value))}
        >
          {save.isPending ? "Saving…" : "Save cap"}
        </Button>
        {settings.maxOutputTokens != null && (
          <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => { setValue(""); save.mutate(null); }}>
            Clear cap
          </Button>
        )}
      </div>
      {settings.maxOutputTokens != null ? (
        <p className="mt-2 text-xs text-primary">Currently capped at {settings.maxOutputTokens.toLocaleString()} output tokens per request.</p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No cap set — each feature uses its own tuned default (up to {highestDefault.toLocaleString()} tokens).</p>
      )}
    </div>
  );
}

function Overview() {
  const { data: org } = useOrg();
  const { data: usage } = useQuery({ queryKey: ["findUsage"], queryFn: findApi.getUsage, enabled: !!org?.id });
  const { data: aiUsage } = useQuery({ queryKey: ["findAiUsage"], queryFn: findApi.getAiUsage, enabled: !!org?.id });
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

        <div className="grid gap-4 md:grid-cols-2">
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

          <Dialog>
            <DialogTrigger asChild>
              <button className="w-full rounded-xl border border-border bg-card-gradient p-6 text-left transition hover:border-primary/60 hover:shadow-glow">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">AI resource usage</div>
                    <h3 className="font-display text-lg font-semibold">Claude spend</h3>
                  </div>
                  <Coins className="h-5 w-5 text-primary" />
                </div>
                <div className="mt-4 flex items-end gap-8">
                  <div>
                    <div className="font-display text-3xl font-bold">{formatUsd(aiUsage?.total.totalCostUsd ?? 0)}</div>
                    <div className="text-xs text-muted-foreground">total est. cost</div>
                  </div>
                  <div>
                    <div className="font-display text-3xl font-bold text-primary">{(aiUsage?.total.totalTokens ?? 0).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">tokens used</div>
                  </div>
                </div>
                <div className="mt-4 text-xs text-primary">{aiUsage?.settings.maxOutputTokens != null ? `Capped at ${aiUsage.settings.maxOutputTokens.toLocaleString()} tokens/request →` : "No per-request cap set →"}</div>
              </button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>AI resource usage</DialogTitle>
                <DialogDescription>
                  Every Claude call Find makes — domain classification, glossary, functional documentation, copilot, and NL report parsing —
                  with its actual token usage and an estimated cost from Anthropic's published per-token pricing.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 md:grid-cols-2">
                <AiUsageColumn title="Total usage" bucket={aiUsage?.total} accent={false} />
                <AiUsageColumn title="This session" bucket={aiUsage?.session} accent />
              </div>
              {aiUsage && <AiCapSettings settings={aiUsage.settings} featureDefaults={aiUsage.featureDefaults} minCapTokens={aiUsage.minCapTokens} />}
            </DialogContent>
          </Dialog>
        </div>

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
