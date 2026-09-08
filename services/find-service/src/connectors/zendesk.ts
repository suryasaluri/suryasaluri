import type { ConnectorModule } from "./types";
import { basicRestTest } from "./shapes/rest";

export const zendeskConnector: ConnectorModule = {
  meta: {
    id: "zendesk",
    label: "Zendesk",
    category: "SaaS",
    connectorType: "API token",
    integration: "real",
    fields: [
      { key: "host", label: "Subdomain", type: "text", placeholder: "yourcompany" },
      { key: "username", label: "Agent email", type: "text" },
      { key: "password", label: "API token", type: "password" },
    ],
  },
  testConnection: (fields) =>
    basicRestTest({
      url: `https://${fields.host ?? ""}.zendesk.com/api/v2/users/me.json`,
      username: `${fields.username ?? ""}/token`,
      password: fields.password ?? "",
    }),
};
