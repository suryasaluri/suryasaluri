import type { SchemaConnectorModule } from "../types";
import { oracleTestConnection, oracleIntrospectSchema } from "./client";

export const oracleConnector: SchemaConnectorModule = {
  meta: {
    id: "oracle",
    label: "Oracle / Oracle Fusion",
    category: "Database",
    connectorType: "oracledb (Thin mode)",
    defaultPort: 1521,
    fields: [
      { key: "host", label: "Host", type: "text" },
      { key: "port", label: "Port", type: "number", placeholder: "1521" },
      { key: "serviceName", label: "Service name / SID", type: "text", placeholder: "ORCLPDB1" },
      { key: "username", label: "Username", type: "text" },
      { key: "password", label: "Password", type: "password" },
    ],
  },
  testConnection: oracleTestConnection,
  introspectSchema: oracleIntrospectSchema,
};
