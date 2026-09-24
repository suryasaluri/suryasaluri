import { Database, FileUp, type LucideIcon } from "lucide-react";

export const CONNECTOR_ICON: Record<string, LucideIcon> = {
  oracle: Database,
  file: FileUp,
};

export function iconFor(connectorId?: string | null): LucideIcon {
  return (connectorId && CONNECTOR_ICON[connectorId]) || Database;
}

export const SENSITIVITY_STYLE: Record<string, string> = {
  PII: "bg-warning/15 text-warning border-warning/30",
  PHI: "bg-destructive/15 text-destructive border-destructive/30",
  PCI: "bg-destructive/15 text-destructive border-destructive/30",
  Internal: "bg-muted text-muted-foreground border-border",
  Public: "bg-success/15 text-success border-success/30",
};
