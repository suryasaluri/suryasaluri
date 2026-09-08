import type { ConnectorModule } from "./types";
import { bearerRestTest } from "./shapes/rest";

export const stripeConnector: ConnectorModule = {
  meta: {
    id: "stripe",
    label: "Stripe",
    category: "SaaS",
    connectorType: "API key",
    integration: "real",
    fields: [{ key: "password", label: "Secret key", type: "password" }],
  },
  testConnection: (fields) => bearerRestTest({ url: "https://api.stripe.com/v1/balance", token: fields.password ?? "" }),
};
