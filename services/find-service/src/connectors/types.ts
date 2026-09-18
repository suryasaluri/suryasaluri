import type { NormalizedSchema } from "../schema/types";

export type ConnectorCategory = "Database";

export type FieldSpec = {
  key: string;
  label: string;
  type: "text" | "password" | "number";
  placeholder?: string;
};

export type ConnectorMeta = {
  id: string;
  label: string;
  category: ConnectorCategory;
  connectorType: string;
  defaultPort?: number;
  fields: FieldSpec[];
};

export type TestResult = {
  ok: boolean;
  message: string;
  meta?: Record<string, unknown>;
};

export type IntrospectionProgressEvent =
  | { type: "table_found"; table: { name: string; objectType: "TABLE" | "VIEW" } };

export type QueryCostEstimate = { cost: number; cardinality: number };

export type SchemaConnectorModule = {
  meta: ConnectorMeta;
  testConnection(fields: Record<string, string>): Promise<TestResult>;
  introspectSchema(
    fields: Record<string, string>,
    onProgress: (event: IntrospectionProgressEvent) => void,
  ): Promise<NormalizedSchema>;
  /** Dry-run cost/cardinality estimate for a report query, without executing it. Optional — a connector without a real cost-estimation mechanism simply omits it. */
  estimateQueryCost?(fields: Record<string, string>, sql: string): Promise<QueryCostEstimate>;
  /** Executes a validated, already-capped report query and returns its rows. */
  runQuery?(fields: Record<string, string>, sql: string, binds: Record<string, unknown>): Promise<Record<string, unknown>[]>;
};
