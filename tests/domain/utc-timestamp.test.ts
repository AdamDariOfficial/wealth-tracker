import { describe, expect, test } from "bun:test";
import { UtcTimestamp, UtcTimestampError } from "../../src/domain/core";

describe("UtcTimestamp", () => {
  test("normalizes explicit offsets to canonical UTC", () => {
    const timestamp = UtcTimestamp.parse("2026-08-07T02:30:15.250+02:00");

    expect(timestamp.toString()).toBe("2026-08-07T00:30:15.250Z");
    expect(timestamp.toJSON()).toBe("2026-08-07T00:30:15.250Z");
  });

  test("orders instants by epoch time", () => {
    const earlier = UtcTimestamp.parse("2026-08-07T00:00:00Z");
    const later = UtcTimestamp.parse("2026-08-07T00:00:01Z");

    expect(earlier.compare(later)).toBe(-1);
    expect(later.compare(earlier)).toBe(1);
    expect(earlier.equals(UtcTimestamp.parse("2026-08-07T02:00:00+02:00"))).toBe(true);
  });

  test("rejects timezone-free and invalid values", () => {
    for (const input of [
      "2026-08-07",
      "2026-08-07T00:00:00",
      " 2026-08-07T00:00:00Z",
      "2026-02-30T00:00:00Z",
      "not-a-date",
    ]) {
      expect(() => UtcTimestamp.parse(input)).toThrow(UtcTimestampError);
    }
  });
});
