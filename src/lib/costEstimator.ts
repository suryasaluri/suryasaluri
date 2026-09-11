import type { Property } from "@/lib/db-types";

export type CostLine = { label: string; amount: number; note?: string };

export function estimateCost(p: Property): { lines: CostLine[]; total: number } {
  const price = Number(p.price);
  if (p.property_type === "plot") {
    const registration = Math.round(price * 0.06);
    const development = Math.round((Number(p.size_sqyd) || 0) * 150);
    const lines: CostLine[] = [
      { label: "Base price", amount: price },
      { label: "Registration & stamp duty", amount: registration, note: "6% of base price" },
      { label: "Development charges", amount: development, note: "₹150 / sq.yd" },
    ];
    return { lines, total: lines.reduce((s, l) => s + l.amount, 0) };
  }

  const registration = Math.round(price * 0.06);
  const amenities = Math.round((Number(p.builtup_area_sqft) || 0) * 75);
  const maintenanceDeposit = Math.round((Number(p.builtup_area_sqft) || 0) * 3 * 24);
  const lines: CostLine[] = [
    { label: "Base price", amount: price },
    { label: "Registration & stamp duty", amount: registration, note: "6% of base price" },
    { label: "Amenities & clubhouse charges", amount: amenities, note: "₹75 / sq.ft built-up" },
    {
      label: "Maintenance deposit",
      amount: maintenanceDeposit,
      note: "24 months advance @ ₹3/sq.ft",
    },
  ];
  return { lines, total: lines.reduce((s, l) => s + l.amount, 0) };
}
