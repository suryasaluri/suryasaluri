import { Database, Cloud, FileBox, Server, Workflow, type LucideIcon } from "lucide-react";
import type { ConnectorCategory } from "@/lib/findApiClient";

export type { ConnectorCategory };

export const CATEGORIES: ConnectorCategory[] = ["Database", "Warehouse", "SaaS", "Storage", "Streaming"];

export const CATEGORY_ICON: Record<ConnectorCategory, LucideIcon> = {
  Database: Database,
  Warehouse: Server,
  SaaS: Cloud,
  Storage: FileBox,
  Streaming: Workflow,
};

const ICON_BY_CONNECTOR_ID: Record<string, LucideIcon> = {
  postgresql: Database,
  mysql: Database,
  mariadb: Database,
  sqlserver: Database,
  oracle: Database,
  mongodb: Database,
  snowflake: Server,
  bigquery: Server,
  redshift: Server,
  databricks: Server,
  salesforce: Cloud,
  hubspot: Cloud,
  stripe: Cloud,
  zendesk: Cloud,
  workday: Cloud,
  s3: FileBox,
  gcs: FileBox,
  azure_blob: FileBox,
  kafka: Workflow,
  kinesis: Workflow,
};

/** Catalog data (labels, categories, field specs) now lives in find-service — GET /connectors is the source of truth. This is just icon lookup for display. */
export function iconFor(connectorId?: string | null, category?: string | null): LucideIcon {
  if (connectorId && ICON_BY_CONNECTOR_ID[connectorId]) return ICON_BY_CONNECTOR_ID[connectorId];
  return CATEGORY_ICON[(category as ConnectorCategory) ?? "Database"] ?? Database;
}

export const SENSITIVITY_STYLE: Record<string, string> = {
  PII: "bg-warning/15 text-warning border-warning/30",
  PHI: "bg-destructive/15 text-destructive border-destructive/30",
  PCI: "bg-destructive/15 text-destructive border-destructive/30",
  Internal: "bg-muted text-muted-foreground border-border",
  Public: "bg-success/15 text-success border-success/30",
};
