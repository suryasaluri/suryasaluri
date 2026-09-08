import type { ConnectorModule } from "./types";
import { querySignedRestTest } from "./shapes/rest";

export const azureBlobConnector: ConnectorModule = {
  meta: {
    id: "azure_blob",
    label: "Azure Blob Storage",
    category: "Storage",
    connectorType: "SAS token",
    integration: "real",
    fields: [
      { key: "host", label: "Container URL", type: "text", placeholder: "https://account.blob.core.windows.net/container" },
      { key: "password", label: "SAS token", type: "password" },
    ],
  },
  testConnection: (fields) => {
    const containerUrl = fields.host ?? "";
    const sasToken = (fields.password ?? "").replace(/^\?/, "");
    if (!containerUrl || !sasToken) return Promise.resolve({ ok: false, message: "Missing required connection details" });
    const sep = containerUrl.includes("?") ? "&" : "?";
    return querySignedRestTest({ url: `${containerUrl}${sep}restype=container&comp=list&${sasToken}` });
  },
};
