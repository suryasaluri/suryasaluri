import type { TestResult } from "../types";
import { errMessage, safeJson } from "./util";

/**
 * OAuth2 resource-owner password-credentials grant against Salesforce's real
 * token endpoint, followed by a real REST call using the issued token.
 */
export async function salesforcePasswordGrantTest(opts: {
  loginUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}): Promise<TestResult> {
  if (!opts.clientId || !opts.clientSecret || !opts.username || !opts.password) {
    return { ok: false, message: "Missing required connection details" };
  }
  try {
    const body = new URLSearchParams({
      grant_type: "password",
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      username: opts.username,
      password: opts.password,
    });
    const tokenRes = await fetch(`${opts.loginUrl.replace(/\/$/, "")}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const tokenBody = await safeJson(tokenRes);
    const accessToken = tokenBody?.access_token as string | undefined;
    const instanceUrl = tokenBody?.instance_url as string | undefined;
    if (!tokenRes.ok || !accessToken) {
      if (tokenRes.status === 400 || tokenRes.status === 401) {
        return { ok: false, message: `Authentication failed: ${(tokenBody?.error_description as string) ?? tokenRes.statusText}` };
      }
      return { ok: false, message: `Unexpected response (HTTP ${tokenRes.status})` };
    }
    const sobjectsRes = await fetch(`${instanceUrl}/services/data/v59.0/sobjects`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!sobjectsRes.ok) return { ok: false, message: `Token issued but API call failed (HTTP ${sobjectsRes.status})` };
    return { ok: true, message: "Connection succeeded", meta: { instance_url: instanceUrl } };
  } catch (e) {
    return { ok: false, message: `Connection failed: ${errMessage(e)}` };
  }
}
