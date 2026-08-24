import { Decimal, type Money } from "@/domain/core";

export type CalendarDeltaStatus = "future" | "unknown" | "partial" | "complete";
export type CalendarDeltaTone = "muted" | "warning" | "neutral" | "positive" | "negative";
export type CalendarDeltaIntensity = 0 | 1 | 2 | 3;

export type CalendarDeltaSource = Readonly<{
  knownDelta: Money | null;
  deltaComplete: boolean;
  future: boolean;
}>;

export type CalendarDeltaVisual = Readonly<{
  status: CalendarDeltaStatus;
  tone: CalendarDeltaTone;
  intensity: CalendarDeltaIntensity;
}>;

const ZERO = Decimal.zero();
const TWO = Decimal.fromInteger(2);
const THREE = Decimal.fromInteger(3);

export function calendarDeltaStatus(source: CalendarDeltaSource): CalendarDeltaStatus {
  if (source.future) return "future";
  if (!source.knownDelta) return "unknown";
  if (!source.deltaComplete) return "partial";
  return "complete";
}

export function calendarHeatmapScale(sources: readonly CalendarDeltaSource[]): Decimal | null {
  let maximum: Decimal | null = null;
  for (const source of sources) {
    if (calendarDeltaStatus(source) !== "complete" || !source.knownDelta) continue;
    const magnitude = source.knownDelta.amount.abs();
    if (magnitude.isZero()) continue;
    if (!maximum || magnitude.compare(maximum) > 0) maximum = magnitude;
  }
  return maximum;
}

export function calendarDeltaVisual(
  source: CalendarDeltaSource,
  maximum: Decimal | null,
): CalendarDeltaVisual {
  const status = calendarDeltaStatus(source);
  if (status === "future" || status === "unknown") {
    return Object.freeze({ status, tone: "muted", intensity: 0 });
  }
  if (status === "partial") {
    return Object.freeze({ status, tone: "warning", intensity: 0 });
  }

  const amount = source.knownDelta?.amount ?? ZERO;
  const comparison = amount.compare(ZERO);
  if (comparison === 0) {
    return Object.freeze({ status, tone: "neutral", intensity: 0 });
  }

  const tone: CalendarDeltaTone = comparison > 0 ? "positive" : "negative";
  const magnitude = amount.abs();
  if (!maximum || maximum.isZero()) {
    return Object.freeze({ status, tone, intensity: 1 });
  }

  // Exact thresholds: >2/3 strong, >1/3 medium, otherwise weak.
  const scaledMagnitude = magnitude.times(THREE);
  const intensity: CalendarDeltaIntensity =
    scaledMagnitude.compare(maximum.times(TWO)) > 0
      ? 3
      : scaledMagnitude.compare(maximum) > 0
        ? 2
        : 1;

  return Object.freeze({ status, tone, intensity });
}
