import type { Database } from "@/integrations/supabase/types";

type Asset = Database["public"]["Tables"]["assets"]["Row"];

export type HealthBand = "good" | "watch" | "critical";

export interface AssetHealth {
  score: number; // 0-100, higher is healthier
  band: HealthBand;
  ageYears: number;
  monthsSinceService: number;
  monthsOverdue: number;
}

const daysBetween = (a: Date, b: Date) => (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);

// Rule-based predictive score, not a trained model: weighs how far through
// its expected life an asset is against how overdue it is for its next
// scheduled service. Deliberately simple and auditable for a demo.
export function computeAssetHealth(
  asset: Pick<
    Asset,
    "install_date" | "expected_life_years" | "service_interval_months" | "last_service_date"
  >,
): AssetHealth {
  const now = new Date();
  const installDate = new Date(asset.install_date);
  const lastService = new Date(asset.last_service_date);

  const ageYears = daysBetween(now, installDate) / 365.25;
  const ageFraction = Math.min(1, Math.max(0, ageYears / Number(asset.expected_life_years)));

  const monthsSinceService = daysBetween(now, lastService) / 30.44;
  const interval = Number(asset.service_interval_months) || 1;
  const overdueFraction = Math.min(1, Math.max(0, (monthsSinceService - interval) / interval));
  const monthsOverdue = Math.max(0, monthsSinceService - interval);

  const score = Math.round(100 - (ageFraction * 55 + overdueFraction * 45));
  const band: HealthBand = score >= 70 ? "good" : score >= 40 ? "watch" : "critical";

  return {
    score: Math.max(0, Math.min(100, score)),
    band,
    ageYears,
    monthsSinceService,
    monthsOverdue,
  };
}

export const HEALTH_BAND_LABEL: Record<HealthBand, string> = {
  good: "Healthy",
  watch: "Watch",
  critical: "Critical",
};
