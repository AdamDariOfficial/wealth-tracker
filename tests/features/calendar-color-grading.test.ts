import { describe, expect, test } from "bun:test";
import { Money } from "../../src/domain/core";
import {
  calendarDeltaStatus,
  calendarDeltaVisual,
  calendarHeatmapScale,
  type CalendarDeltaSource,
} from "../../src/features/wealth-v2/calendar-color-grading";

function source(
  amount: string | null,
  options: Readonly<{ complete?: boolean; future?: boolean }> = {},
): CalendarDeltaSource {
  return {
    knownDelta: amount === null ? null : Money.of(amount, "EUR"),
    deltaComplete: options.complete ?? true,
    future: options.future ?? false,
  };
}

describe("calendar semantic color grading", () => {
  test("distinguishes future, unknown, partial and complete deltas", () => {
    expect(calendarDeltaStatus(source("10", { future: true }))).toBe("future");
    expect(calendarDeltaStatus(source(null))).toBe("unknown");
    expect(calendarDeltaStatus(source("-10", { complete: false }))).toBe("partial");
    expect(calendarDeltaStatus(source("10"))).toBe("complete");
  });

  test("excludes uncertain and future values from the visible scale", () => {
    const maximum = calendarHeatmapScale([
      source("20"),
      source("-100"),
      source("1000", { complete: false }),
      source("-500", { future: true }),
      source(null),
    ]);
    expect(maximum?.toString()).toBe("100");
  });

  test("uses exact three-step signed intensity for complete deltas", () => {
    const maximum = calendarHeatmapScale([source("100")]);
    expect(calendarDeltaVisual(source("20"), maximum)).toEqual({
      status: "complete",
      tone: "positive",
      intensity: 1,
    });
    expect(calendarDeltaVisual(source("-50"), maximum)).toEqual({
      status: "complete",
      tone: "negative",
      intensity: 2,
    });
    expect(calendarDeltaVisual(source("80"), maximum)).toEqual({
      status: "complete",
      tone: "positive",
      intensity: 3,
    });
  });

  test("never encodes uncertain, future, unknown or zero as gain or loss", () => {
    const maximum = calendarHeatmapScale([source("100")]);
    expect(calendarDeltaVisual(source("-40", { complete: false }), maximum)).toEqual({
      status: "partial",
      tone: "warning",
      intensity: 0,
    });
    expect(calendarDeltaVisual(source("40", { future: true }), maximum)).toEqual({
      status: "future",
      tone: "muted",
      intensity: 0,
    });
    expect(calendarDeltaVisual(source(null), maximum)).toEqual({
      status: "unknown",
      tone: "muted",
      intensity: 0,
    });
    expect(calendarDeltaVisual(source("0"), maximum)).toEqual({
      status: "complete",
      tone: "neutral",
      intensity: 0,
    });
  });
});
