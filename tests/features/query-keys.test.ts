import { describe, expect, test } from "bun:test";
import { financialV2Keys } from "../../src/data/query-keys";

describe("Phase 3 financial query keys", () => {
  test("isolates cached financial state by authenticated user", () => {
    expect(financialV2Keys.state("user:a")).toEqual(["financial-v2", "state", "user:a"]);
    expect(financialV2Keys.state("user:b")).toEqual(["financial-v2", "state", "user:b"]);
    expect(financialV2Keys.state("user:a")).not.toEqual(financialV2Keys.state("user:b"));
  });
});
