import { supabaseAdmin } from "../supabaseAdmin";

export type AiFeature = "domain_classification" | "glossary" | "functional_documentation" | "copilot" | "report_nl_parse";

/**
 * Each feature's own tuned max_tokens — sized for its structured tool-use
 * schema (a glossary over a wide schema needs much more room than a
 * yes/no-shaped report spec). This is also the ceiling for an org's cap: a
 * cap only ever tightens a feature's default, it never raises it, so a
 * misconfigured cap can't truncate a schema-shaped tool call mid-JSON.
 */
export const FEATURE_DEFAULT_MAX_TOKENS: Record<AiFeature, number> = {
  domain_classification: 1024,
  copilot: 1024,
  report_nl_parse: 512,
  functional_documentation: 1500,
  glossary: 4096,
};

export const MIN_ORG_CAP_TOKENS = 128;

export type OrgAiSettings = { maxOutputTokens: number | null };

export async function getOrgAiSettings(orgId: string): Promise<OrgAiSettings> {
  const { data } = await supabaseAdmin().from("org_ai_settings").select("max_output_tokens").eq("org_id", orgId).maybeSingle();
  return { maxOutputTokens: data?.max_output_tokens ?? null };
}

export async function setOrgAiSettings(orgId: string, maxOutputTokens: number | null): Promise<OrgAiSettings> {
  if (maxOutputTokens != null && (!Number.isFinite(maxOutputTokens) || maxOutputTokens < MIN_ORG_CAP_TOKENS)) {
    throw new Error(`maxOutputTokens must be null or at least ${MIN_ORG_CAP_TOKENS}`);
  }
  const { error } = await supabaseAdmin()
    .from("org_ai_settings")
    .upsert({ org_id: orgId, max_output_tokens: maxOutputTokens, updated_at: new Date().toISOString() });
  if (error) throw error;
  return { maxOutputTokens };
}

/** The max_tokens to actually send for this feature's request, and whether an org cap was in effect. */
export function resolveMaxTokens(feature: AiFeature, orgSettings: OrgAiSettings): { maxTokens: number; capApplied: number | null } {
  const featureDefault = FEATURE_DEFAULT_MAX_TOKENS[feature];
  if (orgSettings.maxOutputTokens == null) return { maxTokens: featureDefault, capApplied: null };
  const capped = Math.min(featureDefault, orgSettings.maxOutputTokens);
  return { maxTokens: capped, capApplied: orgSettings.maxOutputTokens };
}
