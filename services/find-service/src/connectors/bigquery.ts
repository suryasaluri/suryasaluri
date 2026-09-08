import type { ConnectorModule } from "./types";
import { googleServiceAccountTest } from "./shapes/google";

export const bigqueryConnector: ConnectorModule = {
  meta: {
    id: "bigquery",
    label: "BigQuery",
    category: "Warehouse",
    connectorType: "Service account",
    integration: "real",
    fields: [
      { key: "host", label: "Project ID", type: "text" },
      { key: "password", label: "Service account key (JSON)", type: "password" },
    ],
  },
  testConnection: (fields) =>
    googleServiceAccountTest({
      serviceAccountJson: fields.password ?? "",
      url: `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(fields.host ?? "")}/datasets`,
      scopes: ["https://www.googleapis.com/auth/bigquery.readonly"],
    }),
};
