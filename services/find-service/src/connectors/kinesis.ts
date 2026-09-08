import { KinesisClient, ListStreamsCommand } from "@aws-sdk/client-kinesis";
import type { ConnectorModule } from "./types";
import { awsProbe } from "./shapes/aws";

export const kinesisConnector: ConnectorModule = {
  meta: {
    id: "kinesis",
    label: "AWS Kinesis",
    category: "Streaming",
    connectorType: "AWS SDK",
    integration: "real",
    fields: [
      { key: "region", label: "Region", type: "text", placeholder: "us-east-1" },
      { key: "username", label: "Access key ID", type: "text" },
      { key: "password", label: "Secret access key", type: "password" },
    ],
  },
  testConnection: (fields) =>
    awsProbe(async () => {
      const client = new KinesisClient({
        region: fields.region || "us-east-1",
        credentials: { accessKeyId: fields.username ?? "", secretAccessKey: fields.password ?? "" },
      });
      const res = await client.send(new ListStreamsCommand({}));
      return { streams: (res.StreamNames ?? []).length };
    }),
};
