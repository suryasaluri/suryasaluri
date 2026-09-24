import { supabaseAdmin } from "../supabaseAdmin";
import type { NormalizedSchema, ForeignKeyDef } from "./types";
import type { StatusFieldCandidate } from "./statusFields";

/** Just the timestamp of the latest completed crawl — lighter than loadLatestSchema when a caller only needs to check staleness, not the full schema_objects listing. */
export async function getLastCrawledAt(orgId: string, dataSourceId: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("schema_crawls")
    .select("completed_at")
    .eq("org_id", orgId)
    .eq("data_source_id", dataSourceId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.completed_at ?? null;
}

/** A snapshot's generated_at predating the latest completed crawl means the schema moved underneath it — the deterministic, no-stored-secrets alternative to polling a live database on a timer. */
export function isStale(generatedAt: string, lastCrawledAt: string | null): boolean {
  if (!lastCrawledAt) return false;
  return new Date(generatedAt).getTime() < new Date(lastCrawledAt).getTime();
}

/** The latest crawled schema + detected status fields for a connection, assembled from persisted schema_objects/schema_crawls rows. Shared by documentation, domain classification, and report suggestion. */
export async function loadLatestSchema(
  orgId: string,
  dataSourceId: string,
): Promise<{ schema: NormalizedSchema; statusFields: StatusFieldCandidate[]; lastCrawledAt: string | null }> {
  const { data: objects } = await supabaseAdmin()
    .from("schema_objects")
    .select("*")
    .eq("org_id", orgId)
    .eq("data_source_id", dataSourceId)
    .order("name", { ascending: true });

  const { data: lastCrawl } = await supabaseAdmin()
    .from("schema_crawls")
    .select("*")
    .eq("org_id", orgId)
    .eq("data_source_id", dataSourceId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const schema: NormalizedSchema = {
    tables: (objects ?? []).map((r) => ({
      name: r.name as string,
      objectType: r.object_type as "TABLE" | "VIEW",
      columns: r.columns as { name: string; dataType: string; nullable: boolean }[],
      primaryKey: r.primary_key as string[],
      foreignKeys: r.foreign_keys as ForeignKeyDef[],
      rowEstimate: r.row_estimate as number | null,
    })),
    checkConstraints: [],
  };

  return {
    schema,
    statusFields: (lastCrawl?.status_fields as StatusFieldCandidate[]) ?? [],
    lastCrawledAt: lastCrawl?.completed_at ?? null,
  };
}
