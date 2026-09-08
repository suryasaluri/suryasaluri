import { GoogleAuth } from "google-auth-library";
import type { TestResult } from "../types";
import { errMessage, safeJson } from "./util";

/**
 * Service-account JWT bearer flow: exchange the provided service-account
 * key JSON for a real Google OAuth2 access token, then call a REST endpoint
 * with it. Used by GCS and BigQuery.
 */
export async function googleServiceAccountTest(opts: {
  serviceAccountJson: string;
  url: string;
  scopes: string[];
}): Promise<TestResult> {
  if (!opts.serviceAccountJson) return { ok: false, message: "Missing required connection details" };
  let credentials: unknown;
  try {
    credentials = JSON.parse(opts.serviceAccountJson);
  } catch {
    return { ok: false, message: "Service account key must be valid JSON" };
  }
  try {
    const auth = new GoogleAuth({ credentials: credentials as Record<string, unknown>, scopes: opts.scopes });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    if (!accessToken.token) return { ok: false, message: "Authentication failed: no access token issued" };
    const res = await fetch(opts.url, { headers: { Authorization: `Bearer ${accessToken.token}` } });
    if (res.ok) return { ok: true, message: "Connection succeeded", meta: await safeJson(res) };
    if (res.status === 401 || res.status === 403) return { ok: false, message: `Authentication failed (HTTP ${res.status})` };
    return { ok: false, message: `Unexpected response (HTTP ${res.status})` };
  } catch (e) {
    return { ok: false, message: `Authentication failed: ${errMessage(e)}` };
  }
}
