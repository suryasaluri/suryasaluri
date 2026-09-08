import type { TestResult } from "../types";
import { errMessage, safeJson } from "./util";

function classify(status: number): "ok" | "auth" | "other" {
  if (status >= 200 && status < 300) return "ok";
  if (status === 401 || status === 403) return "auth";
  return "other";
}

/** Bearer-token REST GET, used by Stripe/HubSpot/Databricks-style APIs. */
export async function bearerRestTest(opts: { url: string; token: string }): Promise<TestResult> {
  if (!opts.token) return { ok: false, message: "Missing required connection details" };
  try {
    const res = await fetch(opts.url, { headers: { Authorization: `Bearer ${opts.token}` } });
    const outcome = classify(res.status);
    if (outcome === "ok") return { ok: true, message: "Connection succeeded", meta: await safeJson(res) };
    if (outcome === "auth") return { ok: false, message: `Authentication failed (HTTP ${res.status})` };
    return { ok: false, message: `Unexpected response (HTTP ${res.status})` };
  } catch (e) {
    return { ok: false, message: `Connection failed: ${errMessage(e)}` };
  }
}

/** Basic-auth REST GET, used by Zendesk-style APIs (email/token as username). */
export async function basicRestTest(opts: { url: string; username: string; password: string }): Promise<TestResult> {
  if (!opts.username || !opts.password) return { ok: false, message: "Missing required connection details" };
  try {
    const basic = Buffer.from(`${opts.username}:${opts.password}`).toString("base64");
    const res = await fetch(opts.url, { headers: { Authorization: `Basic ${basic}` } });
    const outcome = classify(res.status);
    if (outcome === "ok") return { ok: true, message: "Connection succeeded", meta: await safeJson(res) };
    if (outcome === "auth") return { ok: false, message: `Authentication failed (HTTP ${res.status})` };
    return { ok: false, message: `Unexpected response (HTTP ${res.status})` };
  } catch (e) {
    return { ok: false, message: `Connection failed: ${errMessage(e)}` };
  }
}

/** SAS-token (or any pre-signed query string) REST GET, used by Azure Blob. */
export async function querySignedRestTest(opts: { url: string }): Promise<TestResult> {
  try {
    const res = await fetch(opts.url);
    const outcome = classify(res.status);
    if (outcome === "ok") return { ok: true, message: "Connection succeeded" };
    if (outcome === "auth") return { ok: false, message: `Authentication failed (HTTP ${res.status})` };
    return { ok: false, message: `Unexpected response (HTTP ${res.status})` };
  } catch (e) {
    return { ok: false, message: `Connection failed: ${errMessage(e)}` };
  }
}
