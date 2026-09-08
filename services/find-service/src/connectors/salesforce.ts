import type { ConnectorModule } from "./types";
import { salesforcePasswordGrantTest } from "./shapes/salesforceOAuth";

export const salesforceConnector: ConnectorModule = {
  meta: {
    id: "salesforce",
    label: "Salesforce",
    category: "SaaS",
    connectorType: "OAuth2 (password grant)",
    integration: "real",
    fields: [
      { key: "host", label: "Login URL", type: "text", placeholder: "https://login.salesforce.com" },
      { key: "client_id", label: "Connected App Client ID", type: "text" },
      { key: "client_secret", label: "Connected App Client Secret", type: "password" },
      { key: "username", label: "Username", type: "text" },
      { key: "password", label: "Password + security token", type: "password" },
    ],
  },
  testConnection: (fields) =>
    salesforcePasswordGrantTest({
      loginUrl: fields.host || "https://login.salesforce.com",
      clientId: fields.client_id ?? "",
      clientSecret: fields.client_secret ?? "",
      username: fields.username ?? "",
      password: fields.password ?? "",
    }),
};
