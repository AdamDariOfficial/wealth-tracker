import { describe, expect, test } from "bun:test";
import type { CalendarOverview } from "../../src/application/view-models";
import { calendarPeriodStatus } from "../../src/features/wealth-v2/calendar-period-status";

function overview(overrides: Record<string, unknown> = {}): CalendarOverview {
  return {
    range: {
      start: new Date("2026-08-24T00:00:00"),
      end: new Date("2026-08-31T00:00:00"),
    },
    buckets: [],
    endValuation: null,
    deltaComplete: false,
    ...overrides,
  } as unknown as CalendarOverview;
}

describe("calendar period status", () => {
  test("fully future range is future, not incomplete", () => {
    expect(calendarPeriodStatus(overview(), new Date("2026-08-20T10:00:00"))).toBe("future");
  });

  test("complete current period ignores future child buckets", () => {
    const current = overview({
      range: {
        start: new Date("2026-08-17"),
        end: new Date("2026-08-24"),
      },
      endValuation: { complete: true },
      deltaComplete: true,
      buckets: [
        {
          future: false,
          knownDelta: { amount: { isZero: () => true } },
          deltaComplete: true,
          valuationComplete: true,
        },
        { future: true },
      ],
    });

    expect(calendarPeriodStatus(current, new Date("2026-08-20"))).toBe("complete");
  });
});
