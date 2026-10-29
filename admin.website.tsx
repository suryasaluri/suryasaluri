import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Youtube,
  Instagram,
  Facebook,
  Music2,
  Activity,
  Check,
  Link2,
  Search,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/AppShell";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/useProfile";
import { INTEGRATION_LABELS, type Integration, type SocialEngagement } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/admin/website")({
  component: WebsiteSettings,
});

const PLATFORM_ICON = {
  youtube: Youtube,
  google_analytics: Activity,
  instagram: Instagram,
  tiktok: Music2,
  facebook_meta: Facebook,
} as const;

function IntegrationRow({ integration }: { integration: Integration }) {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const meta = INTEGRATION_LABELS[integration.platform];
  const Icon = PLATFORM_ICON[integration.platform];
  const [handle, setHandle] = useState(integration.account_handle ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const connect = async () => {
    if (!handle.trim()) return toast.error("Enter an account handle or property ID first");
    setSaving(true);
    try {
      const { error } = await supabase
        .from("integrations")
        .update({
          is_connected: true,
          account_handle: handle.trim(),
          connected_by: profile?.id,
          connected_at: new Date().toISOString(),
        })
        .eq("platform", integration.platform);
      if (error) throw error;
      toast.success(`${meta.label} connected`);
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["integrations"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't connect");
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("integrations")
        .update({ is_connected: false, connected_at: null })
        .eq("platform", integration.platform);
      if (error) throw error;
      toast.success(`${meta.label} disconnected`);
      qc.invalidateQueries({ queryKey: ["integrations"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't disconnect");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-foreground/80">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            {meta.label}
            {integration.is_connected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
                <Check className="h-3 w-3" /> Connected
                {integration.account_handle ? ` · ${integration.account_handle}` : ""}
              </span>
            )}
          </div>
          <p className="mt-0.5 max-w-sm text-xs text-muted-foreground">{meta.description}</p>
        </div>
      </div>

      {integration.is_connected ? (
        <Button variant="outline" size="sm" onClick={disconnect} disabled={saving}>
          Disconnect
        </Button>
      ) : editing ? (
        <div className="flex items-center gap-2">
          <Input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@handle or account ID"
            className="h-9 w-44"
          />
          <Button size="sm" onClick={connect} disabled={saving}>
            {saving ? "Connecting…" : "Connect"}
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Link2 className="mr-1.5 h-3.5 w-3.5" /> Connect
        </Button>
      )}
    </div>
  );
}

const PLATFORM_ICON_SOCIAL = {
  youtube: Youtube,
  instagram: Instagram,
  facebook_meta: Facebook,
  tiktok: Music2,
} as const;

function useWebsiteSnapshot() {
  return useQuery({
    queryKey: ["website-snapshot"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 29);
      const sinceStr = since.toISOString().slice(0, 10);
      const [metrics, social] = await Promise.all([
        supabase.from("website_metrics").select("*").gte("date", sinceStr).order("date"),
        supabase.from("social_engagement").select("*").order("date", { ascending: false }),
      ]);
      if (metrics.error) throw metrics.error;
      if (social.error) throw social.error;
      return { metrics: metrics.data, social: social.data };
    },
  });
}

function SeoTrafficCard() {
  const { data, isLoading } = useWebsiteSnapshot();
  const metrics = data?.metrics ?? [];

  const latest = metrics[metrics.length - 1];
  const sessions30d = metrics.reduce((s, m) => s + m.sessions, 0);
  const leads30d = metrics.reduce((s, m) => s + m.leads_generated, 0);
  const chartData = metrics.map((m) => ({ date: m.date, sessions: m.sessions }));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">SEO &amp; website traffic</CardTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Last 30 days — full breakdown and export under Reports → Website &amp; Marketing.
          </p>
        </div>
        <Link to="/admin/reports">
          <Button variant="outline" size="sm">
            Full report <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border border-border p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Search className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xl font-bold">{latest?.seo_score ?? "—"}/100</div>
                <div className="text-xs text-muted-foreground">SEO score</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xl font-bold">{leads30d}</div>
                <div className="text-xs text-muted-foreground">Leads from website</div>
              </div>
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-bold">{sessions30d.toLocaleString("en-IN")}</div>
                  <div className="text-xs text-muted-foreground">Sessions</div>
                </div>
                <div className="h-10 w-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <Area
                        type="monotone"
                        dataKey="sessions"
                        stroke="var(--color-primary)"
                        fill="var(--color-primary)"
                        fillOpacity={0.15}
                        strokeWidth={1.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EngagementSnapshotCard() {
  const { data, isLoading } = useWebsiteSnapshot();

  const platforms = useMemo(() => {
    const latestByPlatform = new Map<string, SocialEngagement>();
    for (const row of data?.social ?? []) {
      if (!latestByPlatform.has(row.platform)) latestByPlatform.set(row.platform, row);
    }
    return Array.from(latestByPlatform.values()).filter((r) => r.platform in PLATFORM_ICON_SOCIAL);
  }, [data]);

  if (isLoading || !platforms.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Social engagement snapshot</CardTitle>
        <p className="text-sm text-muted-foreground">
          Most recent follower and engagement numbers per connected channel.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {platforms.map((row) => {
          const Icon = PLATFORM_ICON_SOCIAL[row.platform as keyof typeof PLATFORM_ICON_SOCIAL];
          const meta = INTEGRATION_LABELS[row.platform];
          return (
            <div key={row.platform} className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-muted text-foreground/80">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium">{meta.label}</span>
              </div>
              <div className="mt-3 text-xl font-bold">{row.followers.toLocaleString("en-IN")}</div>
              <div className="text-xs text-muted-foreground">
                followers · {Number(row.engagement_rate_pct).toFixed(1)}% engagement
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function IntegrationsCard() {
  const { data: integrations } = useQuery({
    queryKey: ["integrations"],
    queryFn: async (): Promise<Integration[]> => {
      const { data, error } = await supabase.from("integrations").select("*").order("platform");
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Marketing &amp; lead capture integrations</CardTitle>
        <p className="text-sm text-muted-foreground">
          Connect your channels so inquiries and comments flow into Leads &amp; CRM automatically.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {integrations?.map((i) => (
          <IntegrationRow key={i.platform} integration={i} />
        ))}
      </CardContent>
    </Card>
  );
}

function WebsiteSettings() {
  return (
    <div>
      <PageHeader
        title="Website & Marketing"
        desc="Control the public landing page and connect channels that feed your lead pipeline."
      />
      <div className="space-y-6 p-4 md:p-8">
        <SeoTrafficCard />
        <EngagementSnapshotCard />
        <IntegrationsCard />
      </div>
    </div>
  );
}
