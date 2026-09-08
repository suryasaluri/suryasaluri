import type { ConnectorModule } from "./types";
import { bearerRestTest } from "./shapes/rest";

export const databricksConnector: ConnectorModule = {
  meta: {
    id: "databricks",
    label: "Databricks",
    category: "Warehouse",
    connectorType: "Personal access token",
    integration: "real",
    fields: [
      { key: "host", label: "Workspace URL", type: "text", placeholder: "https://xyz.cloud.databricks.com" },
      { key: "password", label: "Access token", type: "password" },
    ],
  },
  testConnection: (fields) =>
    bearerRestTest({ url: `${(fields.host ?? "").replace(/\/$/, "")}/api/2.0/clusters/list`, token: fields.password ?? "" }),
};
