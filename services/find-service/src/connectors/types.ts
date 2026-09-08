export type ConnectorCategory = "Database" | "Warehouse" | "SaaS" | "Storage" | "Streaming";

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
  integration: "real" | "simulated";
  fields: FieldSpec[];
};

export type TestResult = {
  ok: boolean;
  message: string;
  meta?: Record<string, unknown>;
};

export type ConnectorModule = {
  meta: ConnectorMeta;
  testConnection(fields: Record<string, string>): Promise<TestResult>;
};
