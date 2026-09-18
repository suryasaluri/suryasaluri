export type ReportFilter = {
  name: string;
  column: string; // "table.column"
  type: "date_range" | "categorical";
};

export type ReportTemplate = {
  id: string;
  name: string;
  description: string;
  baseTable: string;
  joinTable?: string;
  groupBy: string; // "table.column"
  aggregation: "count" | "avg" | "sum";
  aggregationColumn?: string; // "table.column", required for avg/sum
  filters: ReportFilter[];
};

export type AppliedFilter = { column: string; op: "=" | ">=" | "<="; value: string };

export type ReportSpec = {
  baseTable: string;
  joinTable?: string;
  groupBy: string;
  aggregation: "count" | "avg" | "sum";
  aggregationColumn?: string;
  filters: AppliedFilter[];
  maxRows: number;
};

export type ValidationError = { field: string; reason: string; suggestions: string[] };

export type CostEstimate = { cost: number; cardinality: number; blocked: boolean };

export type ReportRow = Record<string, unknown>;

export type ReportOutcome =
  | { status: "validation_error"; input?: string; errors: ValidationError[] }
  | { status: "blocked"; input?: string; sql: string; binds: Record<string, unknown>; estimate: CostEstimate }
  | {
      status: "success";
      input?: string;
      sql: string;
      binds: Record<string, unknown>;
      estimate: CostEstimate;
      cached: boolean;
      rows: ReportRow[];
      latencyMs: number;
    };
