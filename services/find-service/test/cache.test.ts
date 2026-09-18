import { describe, test, expect } from "bun:test";
import { cacheKey, getCached, setCached } from "../src/reports/cache";

describe("report cache", () => {
  test("misses before being set, hits after", () => {
    const key = cacheKey("org1", "ds1", "SELECT 1", {});
    expect(getCached(key)).toBeUndefined();
    setCached(key, [{ n: 1 }], { cost: 5, cardinality: 10, blocked: false });
    const hit = getCached(key);
    expect(hit?.rows).toEqual([{ n: 1 }]);
    expect(hit?.estimate.cardinality).toBe(10);
  });

  test("keys are distinct per org/data source/sql/binds", () => {
    const a = cacheKey("org1", "ds1", "SELECT 1", { p0: "x" });
    const b = cacheKey("org1", "ds1", "SELECT 1", { p0: "y" });
    const c = cacheKey("org2", "ds1", "SELECT 1", { p0: "x" });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});
