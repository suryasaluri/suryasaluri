import type { SchemaConnectorModule } from "./types";
import { oracleConnector } from "./oracle";
import { fileConnector } from "./file";

// New connectors are added here as their own module implementing
// SchemaConnectorModule — nothing else in the service changes, per the
// "plug-in style support for other databases" requirement. `file` isn't a
// live database — it's a zero-setup way to try Nexus against a real export
// before anyone hands over credentials, the same trust-lowering trick a
// public-repo demo plays for a codebase tool.
const MODULES: SchemaConnectorModule[] = [oracleConnector, fileConnector];

const REGISTRY = new Map(MODULES.map((m) => [m.meta.id, m]));

export function getConnector(id: string): SchemaConnectorModule | undefined {
  return REGISTRY.get(id);
}

export function listConnectors(): SchemaConnectorModule[] {
  return MODULES;
}
