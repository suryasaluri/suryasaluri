import type { ConnectorModule } from "./types";
import { stripeConnector } from "./stripe";
import { hubspotConnector } from "./hubspot";
import { zendeskConnector } from "./zendesk";
import { databricksConnector } from "./databricks";
import { s3Connector } from "./s3";
import { kinesisConnector } from "./kinesis";
import { gcsConnector } from "./gcs";
import { bigqueryConnector } from "./bigquery";
import { azureBlobConnector } from "./azureBlob";
import { salesforceConnector } from "./salesforce";
import { simulatedConnectors } from "./simulated";

const MODULES: ConnectorModule[] = [
  stripeConnector,
  hubspotConnector,
  zendeskConnector,
  databricksConnector,
  s3Connector,
  kinesisConnector,
  gcsConnector,
  bigqueryConnector,
  azureBlobConnector,
  salesforceConnector,
  ...simulatedConnectors,
];

const REGISTRY = new Map(MODULES.map((m) => [m.meta.id, m]));

export function getConnector(id: string): ConnectorModule | undefined {
  return REGISTRY.get(id);
}

export function listConnectors(): ConnectorModule[] {
  return MODULES;
}

export const CATEGORIES = ["Database", "Warehouse", "SaaS", "Storage", "Streaming"] as const;
