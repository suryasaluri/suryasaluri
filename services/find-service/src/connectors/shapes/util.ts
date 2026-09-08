export function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function safeJson(res: Response): Promise<Record<string, unknown> | undefined> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
