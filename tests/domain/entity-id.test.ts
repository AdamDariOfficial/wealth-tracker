import { describe, expect, test } from "bun:test";
import { EntityId, EntityIdError } from "../../src/domain/core";

describe("EntityId", () => {
  test("accepts UUID and namespaced identifiers without changing them", () => {
    const uuid = EntityId.parse<"account">("47cb3c19-9d63-4e05-b468-593f8f499810");
    const namespaced = EntityId.parse<"asset">("asset:btc.main");

    expect(uuid.toString()).toBe("47cb3c19-9d63-4e05-b468-593f8f499810");
    expect(namespaced.toJSON()).toBe("asset:btc.main");
  });

  test("rejects whitespace, unsafe characters and excessive length", () => {
    for (const input of ["", " id", "id ", "with space", "unsafe/segment", "a".repeat(129)]) {
      expect(() => EntityId.parse<"account">(input)).toThrow(EntityIdError);
    }
  });

  test("preserves compile-time kind while comparing the same kind", () => {
    const first = EntityId.parse<"transaction">("tx-1");
    const same = EntityId.parse<"transaction">("tx-1");
    const other = EntityId.parse<"transaction">("tx-2");

    expect(first.equals(same)).toBe(true);
    expect(first.equals(other)).toBe(false);
  });
});
