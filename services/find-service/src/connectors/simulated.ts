import type { ConnectorMeta, ConnectorModule, FieldSpec } from "./types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeSimulated(meta: Omit<ConnectorMeta, "integration">): ConnectorModule {
  return {
    meta: { ...meta, integration: "simulated" },
    testConnection: async (fields) => {
      await sleep(500 + Math.random() * 700);
      const required = meta.fields.filter((f) => f.type !== "number");
      const filled = required.every((f) => (fields[f.key] ?? "").trim().length > 0);
      if (!filled) return { ok: false, message: "Missing required connection details" };
      const pass = Math.random() < 0.88;
      return pass
        ? { ok: true, message: "Connection succeeded (simulated)" }
        : { ok: false, message: "Authentication failed (simulated)" };
    },
  };
}

const dbFields = (portPlaceholder: string): FieldSpec[] => [
  { key: "host", label: "Host", type: "text" },
  { key: "port", label: "Port", type: "number", placeholder: portPlaceholder },
  { key: "username", label: "Username", type: "text" },
  { key: "password", label: "Password", type: "password" },
];

export const simulatedConnectors: ConnectorModule[] = [
  makeSimulated({ id: "postgresql", label: "PostgreSQL", category: "Database", connectorType: "JDBC", defaultPort: 5432, fields: dbFields("5432") }),
  makeSimulated({ id: "mysql", label: "MySQL", category: "Database", connectorType: "native", defaultPort: 3306, fields: dbFields("3306") }),
  makeSimulated({ id: "mariadb", label: "MariaDB", category: "Database", connectorType: "native", defaultPort: 3306, fields: dbFields("3306") }),
  makeSimulated({ id: "sqlserver", label: "SQL Server", category: "Database", connectorType: "JDBC", defaultPort: 1433, fields: dbFields("1433") }),
  makeSimulated({ id: "oracle", label: "Oracle", category: "Database", connectorType: "Thin", defaultPort: 1521, fields: dbFields("1521") }),
  makeSimulated({
    id: "mongodb",
    label: "MongoDB",
    category: "Database",
    connectorType: "native",
    defaultPort: 27017,
    fields: [
      { key: "host", label: "Host / connection string", type: "text", placeholder: "mongodb://..." },
      { key: "username", label: "Username", type: "text" },
      { key: "password", label: "Password", type: "password" },
    ],
  }),
  makeSimulated({
    id: "snowflake",
    label: "Snowflake",
    category: "Warehouse",
    connectorType: "JDBC",
    fields: [
      { key: "host", label: "Account URL", type: "text", placeholder: "xy12345.snowflakecomputing.com" },
      { key: "username", label: "Username", type: "text" },
      { key: "password", label: "Password", type: "password" },
    ],
  }),
  makeSimulated({ id: "redshift", label: "Redshift", category: "Warehouse", connectorType: "JDBC", defaultPort: 5439, fields: dbFields("5439") }),
  makeSimulated({
    id: "kafka",
    label: "Apache Kafka",
    category: "Streaming",
    connectorType: "native",
    defaultPort: 9092,
    fields: [
      { key: "host", label: "Bootstrap servers", type: "text" },
      { key: "port", label: "Port", type: "number", placeholder: "9092" },
    ],
  }),
  makeSimulated({
    id: "workday",
    label: "Workday",
    category: "SaaS",
    connectorType: "OAuth2 (client credentials)",
    fields: [
      { key: "host", label: "Tenant URL", type: "text" },
      { key: "client_id", label: "Client ID", type: "text" },
      { key: "client_secret", label: "Client Secret", type: "password" },
    ],
  }),
];
