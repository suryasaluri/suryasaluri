import {
  Database,
  Cloud,
  FileBox,
  Server,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type ConnectorCategory = "Database" | "Warehouse" | "SaaS" | "Storage" | "Streaming";

export type ConnectionField = {
  key: string;
  label: string;
  type: "text" | "password" | "number";
  placeholder?: string;
};

export type Connector = {
  id: string;
  label: string;
  category: ConnectorCategory;
  icon: LucideIcon;
  defaultPort?: number;
  connectorType: string;
  fields: ConnectionField[];
};

export const CATEGORY_ICON: Record<ConnectorCategory, LucideIcon> = {
  Database: Database,
  Warehouse: Server,
  SaaS: Cloud,
  Storage: FileBox,
  Streaming: Workflow,
};

export const CONNECTOR_CATALOG: Connector[] = [
  // Database
  { id: "postgresql", label: "PostgreSQL", category: "Database", icon: Database, defaultPort: 5432, connectorType: "JDBC",
    fields: [{ key: "host", label: "Host", type: "text", placeholder: "db.internal" }, { key: "port", label: "Port", type: "number", placeholder: "5432" }, { key: "username", label: "Username", type: "text" }, { key: "password", label: "Password", type: "password" }] },
  { id: "mysql", label: "MySQL", category: "Database", icon: Database, defaultPort: 3306, connectorType: "native",
    fields: [{ key: "host", label: "Host", type: "text", placeholder: "db.internal" }, { key: "port", label: "Port", type: "number", placeholder: "3306" }, { key: "username", label: "Username", type: "text" }, { key: "password", label: "Password", type: "password" }] },
  { id: "mariadb", label: "MariaDB", category: "Database", icon: Database, defaultPort: 3306, connectorType: "native",
    fields: [{ key: "host", label: "Host", type: "text" }, { key: "port", label: "Port", type: "number", placeholder: "3306" }, { key: "username", label: "Username", type: "text" }, { key: "password", label: "Password", type: "password" }] },
  { id: "sqlserver", label: "SQL Server", category: "Database", icon: Database, defaultPort: 1433, connectorType: "JDBC",
    fields: [{ key: "host", label: "Host", type: "text" }, { key: "port", label: "Port", type: "number", placeholder: "1433" }, { key: "username", label: "Username", type: "text" }, { key: "password", label: "Password", type: "password" }] },
  { id: "oracle", label: "Oracle", category: "Database", icon: Database, defaultPort: 1521, connectorType: "Thin",
    fields: [{ key: "host", label: "Host", type: "text" }, { key: "port", label: "Port", type: "number", placeholder: "1521" }, { key: "username", label: "Username", type: "text" }, { key: "password", label: "Password", type: "password" }] },
  { id: "mongodb", label: "MongoDB", category: "Database", icon: Database, defaultPort: 27017, connectorType: "native",
    fields: [{ key: "host", label: "Host / connection string", type: "text", placeholder: "mongodb://..." }, { key: "username", label: "Username", type: "text" }, { key: "password", label: "Password", type: "password" }] },

  // Warehouse
  { id: "snowflake", label: "Snowflake", category: "Warehouse", icon: Server, connectorType: "JDBC",
    fields: [{ key: "host", label: "Account URL", type: "text", placeholder: "xy12345.snowflakecomputing.com" }, { key: "username", label: "Username", type: "text" }, { key: "password", label: "Password", type: "password" }] },
  { id: "bigquery", label: "BigQuery", category: "Warehouse", icon: Server, connectorType: "Service account",
    fields: [{ key: "host", label: "Project ID", type: "text" }, { key: "password", label: "Service account key", type: "password" }] },
  { id: "redshift", label: "Redshift", category: "Warehouse", icon: Server, defaultPort: 5439, connectorType: "JDBC",
    fields: [{ key: "host", label: "Cluster endpoint", type: "text" }, { key: "port", label: "Port", type: "number", placeholder: "5439" }, { key: "username", label: "Username", type: "text" }, { key: "password", label: "Password", type: "password" }] },
  { id: "databricks", label: "Databricks", category: "Warehouse", icon: Server, connectorType: "JDBC",
    fields: [{ key: "host", label: "Workspace URL", type: "text" }, { key: "password", label: "Access token", type: "password" }] },

  // SaaS
  { id: "salesforce", label: "Salesforce", category: "SaaS", icon: Cloud, connectorType: "OAuth",
    fields: [{ key: "host", label: "Instance URL", type: "text", placeholder: "api.salesforce.com" }] },
  { id: "hubspot", label: "HubSpot", category: "SaaS", icon: Cloud, connectorType: "API key",
    fields: [{ key: "password", label: "API key", type: "password" }] },
  { id: "stripe", label: "Stripe", category: "SaaS", icon: Cloud, connectorType: "API key",
    fields: [{ key: "password", label: "Secret key", type: "password" }] },
  { id: "zendesk", label: "Zendesk", category: "SaaS", icon: Cloud, connectorType: "API key",
    fields: [{ key: "host", label: "Subdomain", type: "text", placeholder: "yourcompany.zendesk.com" }, { key: "password", label: "API token", type: "password" }] },
  { id: "workday", label: "Workday", category: "SaaS", icon: Cloud, connectorType: "OAuth",
    fields: [{ key: "host", label: "Tenant URL", type: "text" }] },

  // Storage
  { id: "s3", label: "AWS S3", category: "Storage", icon: FileBox, connectorType: "boto3",
    fields: [{ key: "host", label: "Bucket name", type: "text" }, { key: "username", label: "Access key ID", type: "text" }, { key: "password", label: "Secret access key", type: "password" }] },
  { id: "gcs", label: "Google Cloud Storage", category: "Storage", icon: FileBox, connectorType: "Service account",
    fields: [{ key: "host", label: "Bucket name", type: "text" }, { key: "password", label: "Service account key", type: "password" }] },
  { id: "azure_blob", label: "Azure Blob Storage", category: "Storage", icon: FileBox, connectorType: "SAS token",
    fields: [{ key: "host", label: "Container URL", type: "text" }, { key: "password", label: "SAS token", type: "password" }] },

  // Streaming
  { id: "kafka", label: "Apache Kafka", category: "Streaming", icon: Workflow, defaultPort: 9092, connectorType: "native",
    fields: [{ key: "host", label: "Bootstrap servers", type: "text" }, { key: "port", label: "Port", type: "number", placeholder: "9092" }] },
  { id: "kinesis", label: "AWS Kinesis", category: "Streaming", icon: Workflow, connectorType: "boto3",
    fields: [{ key: "host", label: "Stream name", type: "text" }, { key: "username", label: "Access key ID", type: "text" }, { key: "password", label: "Secret access key", type: "password" }] },
];

export const CATEGORIES: ConnectorCategory[] = ["Database", "Warehouse", "SaaS", "Storage", "Streaming"];

export function connectorFor(serviceType: string): Connector | undefined {
  return CONNECTOR_CATALOG.find((c) => c.label === serviceType);
}

export function iconFor(serviceType: string, category?: string | null): LucideIcon {
  return connectorFor(serviceType)?.icon ?? CATEGORY_ICON[(category as ConnectorCategory) ?? "Database"] ?? Database;
}

type SensitivitySource = { name: string; service_type?: string | null; category?: string | null };

const PCI_HINTS = ["finance", "billing", "payment", "invoice", "card", "stripe", "aml"];
const PHI_HINTS = ["health", "patient", "medical", "hipaa", "clinical"];
const PII_HINTS = ["customer", "crm", "salesforce", "hubspot", "marketing", "user", "lead", "contact", "workday", "hr", "zendesk"];

/** Deterministic heuristic classification for the demo — keyword match on name/service type. */
export function classifySensitivity(source: SensitivitySource): string[] {
  const haystack = `${source.name} ${source.service_type ?? ""}`.toLowerCase();
  const labels: string[] = [];
  if (PCI_HINTS.some((h) => haystack.includes(h))) labels.push("PCI");
  if (PHI_HINTS.some((h) => haystack.includes(h))) labels.push("PHI");
  if (PII_HINTS.some((h) => haystack.includes(h))) labels.push("PII");
  if (labels.length === 0) labels.push(source.category === "Storage" || source.category === "Streaming" ? "Internal" : "Public");
  return labels;
}

export const SENSITIVITY_STYLE: Record<string, string> = {
  PII: "bg-warning/15 text-warning border-warning/30",
  PHI: "bg-destructive/15 text-destructive border-destructive/30",
  PCI: "bg-destructive/15 text-destructive border-destructive/30",
  Internal: "bg-muted text-muted-foreground border-border",
  Public: "bg-success/15 text-success border-success/30",
};

/** Deterministic mock schema preview, seeded from the source's own row/table counts. */
export function mockSchemaPreview(source: { id: string; table_count?: number | null; row_count?: number | null; service_type?: string | null }) {
  const seedBase = Array.from(source.id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const tableCount = Math.min(source.table_count ?? 0, 6) || (seedBase % 4) + 1;
  const nouns = ["customers", "orders", "events", "accounts", "invoices", "sessions", "products", "transactions"];
  const columnPool = ["id", "created_at", "updated_at", "email", "name", "amount", "status", "user_id", "metadata"];
  return Array.from({ length: tableCount }, (_, i) => {
    const seed = seedBase + i * 7;
    const rows = Math.max(100, Math.round(((source.row_count ?? 10000) / tableCount) * (0.5 + ((seed % 50) / 50))));
    const colCount = 3 + (seed % 5);
    return {
      table: nouns[(seed + i) % nouns.length] + (i > nouns.length - 1 ? `_${i}` : ""),
      rows,
      columns: Array.from({ length: colCount }, (_, j) => columnPool[(seed + j) % columnPool.length]),
    };
  });
}
