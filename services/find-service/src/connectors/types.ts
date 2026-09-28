import type { NormalizedSchema } from "../schema/types";

export type ConnectorCategory = "Database" | "File";

export type FieldSpec = {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "file";
  placeholder?: string;
  /** Set on a field the UI fills in automatically (e.g. a file's name, captured alongside its content) rather than one the user types into directly. */
  hidden?: boolean;
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
  /** Read-only — runs a `SELECT COUNT(*) ...`-shaped query and returns the count. Used to check whether adding a constraint would be safe before ever writing anything. Optional — a connector with no live database (e.g. the file connector) simply omits it. */
  countRows?(fields: Record<string, string>, sql: string): Promise<number>;
  /** Executes schema-mutating DDL (currently only a validated `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` statement). Optional and deliberately rare — most connectors are read-only by design; only a connector that explicitly implements this can ever write to a customer's schema. */
  applyDdl?(fields: Record<string, string>, sql: string): Promise<void>;
};
