import { describe, test, expect } from "bun:test";
import { isStale } from "../src/schema/loadLatest";

describe("isStale", () => {
  test("never stale when there's no completed crawl yet", () => {
    expect(isStale("2026-01-01T00:00:00Z", null)).toBe(false);
  });

  test("stale when the snapshot predates the latest crawl", () => {
    expect(isStale("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z")).toBe(true);
  });

  test("not stale when the snapshot is newer than the latest crawl", () => {
    expect(isStale("2026-01-03T00:00:00Z", "2026-01-02T00:00:00Z")).toBe(false);
  });

  test("not stale when generated at exactly the same instant as the crawl", () => {
    expect(isStale("2026-01-02T00:00:00Z", "2026-01-02T00:00:00Z")).toBe(false);
  });
});
