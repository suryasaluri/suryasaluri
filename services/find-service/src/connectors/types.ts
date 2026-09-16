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

export type SchemaConnectorModule = {
  meta: ConnectorMeta;
  testConnection(fields: Record<string, string>): Promise<TestResult>;
  introspectSchema(
    fields: Record<string, string>,
    onProgress: (event: IntrospectionProgressEvent) => void,
  ): Promise<NormalizedSchema>;
};
