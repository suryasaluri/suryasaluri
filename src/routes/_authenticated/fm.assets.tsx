import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/useProfile";
import { useComplex } from "@/lib/useFM";
import { computeAssetHealth, HEALTH_BAND_LABEL, type HealthBand } from "@/lib/assetHealth";
import { ASSET_CATEGORY_LABELS, type Asset } from "@/lib/db-types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/fm/assets")({
  component: Assets,
});

const BAND_STYLE: Record<HealthBand, string> = {
  good: "bg-success/12 text-success",
  watch: "bg-warning/15 text-warning",
  critical: "bg-destructive/12 text-destructive",
};

function useAssets(complexId: string | undefined) {
  return useQuery({
    queryKey: ["fm-assets", complexId],
    enabled: !!complexId,
    queryFn: async (): Promise<Asset[]> => {
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("complex_id", complexId!);
      if (error) throw error;
      return data;
    },
  });
}

function Assets() {
  const { data: profile } = useProfile();
  const { data: complex } = useComplex();
  const { data: assets, isLoading } = useAssets(complex?.id);

  if (profile && profile.role === "customer") {
    return (
      <p className="text-sm text-muted-foreground">
        This page is for the facility management team.
      </p>
    );
  }

  const ranked = [...(assets ?? [])]
    .map((a) => ({ asset: a, health: computeAssetHealth(a) }))
    .sort((a, b) => a.health.score - b.health.score);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">
          Assets &amp; Predictive Health
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A rule-based estimate from each asset's age against its expected life and service schedule
          — not a guarantee, but a prioritized worklist.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {ranked.map(({ asset, health }) => (
          <Card key={asset.id}>
            <CardHeader className="flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{asset.name}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {ASSET_CATEGORY_LABELS[asset.category]}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                  BAND_STYLE[health.band],
                )}
              >
                {HEALTH_BAND_LABEL[health.band]}
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Predictive health score</span>
                  <span className="font-semibold text-foreground">{health.score}/100</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      health.band === "good"
                        ? "bg-success"
                        : health.band === "watch"
                          ? "bg-warning"
                          : "bg-destructive",
                    )}
                    style={{ width: `${health.score}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5" /> {health.ageYears.toFixed(1)} yrs in service
                </div>
                <div>Expected life: {asset.expected_life_years} yrs</div>
                <div>Last serviced: {formatDate(asset.last_service_date)}</div>
                <div>
                  {health.monthsOverdue > 0.5
                    ? `${Math.round(health.monthsOverdue)} mo overdue for service`
                    : `Every ${asset.service_interval_months} mo`}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
