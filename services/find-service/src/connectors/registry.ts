import type { SchemaConnectorModule } from "./types";
import { oracleConnector } from "./oracle";

// One connector today. New database types are added here as their own
// module implementing SchemaConnectorModule — nothing else in the service
// changes, per the "plug-in style support for other databases" requirement.
const MODULES: SchemaConnectorModule[] = [oracleConnector];

const REGISTRY = new Map(MODULES.map((m) => [m.meta.id, m]));

export function getConnector(id: string): SchemaConnectorModule | undefined {
  return REGISTRY.get(id);
}

export function listConnectors(): SchemaConnectorModule[] {
  return MODULES;
}
