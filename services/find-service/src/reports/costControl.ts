import type { CostEstimate } from "./types";

/** Optimizer-cost and estimated-row-count caps — Oracle's mechanical equivalent of BigQuery's "reject a dry run over N bytes". Abstract units, not bytes; override via env for a given instance's tolerance. */
export const CAP_COST = Number(process.env.REPORT_MAX_COST ?? 10_000);
export const CAP_CARDINALITY = Number(process.env.REPORT_MAX_CARDINALITY ?? 1_000_000);

export function evaluateEstimate(raw: { cost: number; cardinality: number }): CostEstimate {
  const blocked = raw.cost > CAP_COST || raw.cardinality > CAP_CARDINALITY;
  return { cost: raw.cost, cardinality: raw.cardinality, blocked };
}
