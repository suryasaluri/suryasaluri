import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import type { ConnectorModule } from "./types";
import { awsProbe } from "./shapes/aws";

export const s3Connector: ConnectorModule = {
  meta: {
    id: "s3",
    label: "AWS S3",
    category: "Storage",
    connectorType: "AWS SDK",
    integration: "real",
    fields: [
      { key: "host", label: "Bucket name", type: "text" },
      { key: "region", label: "Region", type: "text", placeholder: "us-east-1" },
      { key: "username", label: "Access key ID", type: "text" },
      { key: "password", label: "Secret access key", type: "password" },
    ],
  },
  testConnection: (fields) =>
    awsProbe(async () => {
      const client = new S3Client({
        region: fields.region || "us-east-1",
        credentials: { accessKeyId: fields.username ?? "", secretAccessKey: fields.password ?? "" },
      });
      const res = await client.send(new ListBucketsCommand({}));
      return { buckets: (res.Buckets ?? []).length };
    }),
};
