import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Youtube, Instagram, Facebook, Music2, Activity, Check, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/AppShell";
import { HeroBackground } from "@/components/HeroBackground";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/lib/useSiteSettings";
import { useProfile } from "@/lib/useProfile";
import { INTEGRATION_LABELS, type HeroAnimation, type Integration } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/admin/website")({
  component: WebsiteSettings,
});

const ANIMATION_OPTIONS: { value: HeroAnimation; label: string; desc: string }[] = [
  { value: "aurora", label: "Aurora", desc: "Slow-drifting soft color blobs" },
  { value: "grid_pulse", label: "Grid Pulse", desc: "Breathing dotted-grid texture" },
  { value: "particles", label: "Particles", desc: "Rising accent-colored specks" },
  { value: "none", label: "Static", desc: "No motion — plain background" },
];

const PLATFORM_ICON = {
  youtube: Youtube,
  google_analytics: Activity,
  instagram: Instagram,
  tiktok: Music2,
  facebook_meta: Facebook,
} as const;

function HeroAnimationCard() {
  const { data: settings } = useSiteSettings();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<HeroAnimation>("aurora");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) setSelected(settings.hero_animation);
  }, [settings]);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("site_settings")
        .update({ hero_animation: selected, updated_by: profile?.id })
        .eq("id", true);
      if (error) throw error;
      toast.success("Landing page animation updated");
      qc.invalidateQueries({ queryKey: ["site-settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Landing page animation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative h-28 overflow-hidden rounded-xl border border-border bg-background">
          <HeroBackground animation={selected} />
          <div className="relative flex h-full items-center justify-center text-xs text-muted-foreground">
            Live preview
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ANIMATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className={`rounded-xl border p-3 text-left transition ${
                selected === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{opt.label}</span>
                {selected === opt.value && <Check className="h-3.5 w-3.5 text-primary" />}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{opt.desc}</p>
            </button>
          ))}
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save animation"}
        </Button>
      </CardContent>
    </Card>
  );
}

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
        <HeroAnimationCard />
        <IntegrationsCard />
      </div>
    </div>
  );
}
