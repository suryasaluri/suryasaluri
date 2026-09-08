import type { ConnectorModule } from "./types";
import { googleServiceAccountTest } from "./shapes/google";

export const gcsConnector: ConnectorModule = {
  meta: {
    id: "gcs",
    label: "Google Cloud Storage",
    category: "Storage",
    connectorType: "Service account",
    integration: "real",
    fields: [
      { key: "host", label: "Bucket name", type: "text" },
      { key: "password", label: "Service account key (JSON)", type: "password" },
    ],
  },
  testConnection: (fields) =>
    googleServiceAccountTest({
      serviceAccountJson: fields.password ?? "",
      url: `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(fields.host ?? "")}`,
      scopes: ["https://www.googleapis.com/auth/devstorage.read_only"],
    }),
};
