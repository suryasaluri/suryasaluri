import type { ConnectorModule } from "./types";
import { bearerRestTest } from "./shapes/rest";

export const hubspotConnector: ConnectorModule = {
  meta: {
    id: "hubspot",
    label: "HubSpot",
    category: "SaaS",
    connectorType: "API key",
    integration: "real",
    fields: [{ key: "password", label: "Private app token", type: "password" }],
  },
  testConnection: (fields) =>
    bearerRestTest({ url: "https://api.hubapi.com/crm/v3/objects/contacts?limit=1", token: fields.password ?? "" }),
};
