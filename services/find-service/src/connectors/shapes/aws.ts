import type { TestResult } from "../types";
import { errMessage } from "./util";

type AwsError = { name?: string; $metadata?: { httpStatusCode?: number } };

/** Runs an AWS SDK v3 call and maps its outcome/errors into a TestResult. */
export async function awsProbe(fn: () => Promise<Record<string, unknown> | void>): Promise<TestResult> {
  try {
    const result = await fn();
    return { ok: true, message: "Connection succeeded", meta: result ?? undefined };
  } catch (e) {
    const err = e as AwsError;
    const status = err.$metadata?.httpStatusCode;
    const authNames = new Set(["AccessDenied", "UnauthorizedOperation", "InvalidAccessKeyId", "SignatureDoesNotMatch"]);
    if (status === 401 || status === 403 || (err.name && authNames.has(err.name))) {
      return { ok: false, message: `Authentication failed: ${errMessage(e)}` };
    }
    return { ok: false, message: `Connection failed: ${errMessage(e)}` };
  }
}
