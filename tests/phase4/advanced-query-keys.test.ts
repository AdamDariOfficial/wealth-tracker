import { describe, expect, test } from "bun:test";
import { advancedV2Keys } from "../../src/data/query-keys";

describe("Phase 4 advanced query keys", () => {
  test("isolates advanced state by authenticated user", () => {
    expect(advancedV2Keys.state("user-a")).toEqual(["advanced-v2", "state", "user-a"]);
    expect(advancedV2Keys.state("user-b")).toEqual(["advanced-v2", "state", "user-b"]);
    expect(advancedV2Keys.state("user-a")).not.toEqual(advancedV2Keys.state("user-b"));
  });
});
