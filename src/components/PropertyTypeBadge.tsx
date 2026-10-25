import { LandPlot, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PropertyType } from "@/lib/db-types";

const CONFIG: Record<PropertyType, { label: string; icon: typeof LandPlot; className: string }> = {
  plot: {
    label: "Plot",
    icon: LandPlot,
    className: "bg-success/12 text-success",
  },
  flat: {
    label: "Flat",
    icon: Building2,
    className: "bg-chart-3/15 text-chart-3",
  },
};

export function PropertyTypeBadge({ type, className }: { type: PropertyType; className?: string }) {
  const c = CONFIG[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        c.className,
        className,
      )}
    >
      <c.icon className="h-3.5 w-3.5" />
      {c.label}
    </span>
  );
}
