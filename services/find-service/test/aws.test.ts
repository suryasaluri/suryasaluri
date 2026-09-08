import { describe, test, expect } from "bun:test";
import { awsProbe } from "../src/connectors/shapes/aws";

describe("awsProbe", () => {
  test("wraps a successful call as ok", async () => {
    const result = await awsProbe(async () => ({ buckets: 3 }));
    expect(result.ok).toBe(true);
    expect(result.meta).toEqual({ buckets: 3 });
  });

  test("maps an AWS AccessDenied error to an auth failure", async () => {
    const result = await awsProbe(async () => {
      const err = new Error("Access Denied") as Error & { name: string };
      err.name = "AccessDenied";
      throw err;
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/authentication failed/i);
  });

  test("maps a 403 $metadata status to an auth failure", async () => {
    const result = await awsProbe(async () => {
      const err = new Error("Forbidden") as Error & { $metadata: { httpStatusCode: number } };
      err.$metadata = { httpStatusCode: 403 };
      throw err;
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/authentication failed/i);
  });

  test("maps an unrelated failure to a generic connection failure", async () => {
    const result = await awsProbe(async () => {
      throw new Error("getaddrinfo ENOTFOUND s3.amazonaws.com");
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/connection failed/i);
  });
});
