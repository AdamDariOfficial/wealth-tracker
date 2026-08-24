import type { CalendarOverview } from "@/application/view-models";
import { calendarDeltaStatus } from "@/features/wealth-v2/calendar-color-grading";

export type CalendarPeriodStatus = "future" | "partial" | "complete";

export function calendarPeriodStatus(
  overview: CalendarOverview,
  now: Date = new Date(),
): CalendarPeriodStatus {
  if (overview.range.start.getTime() > now.getTime()) return "future";
  const hasIncompletePastBucket = overview.buckets.some((bucket) => {
    if (bucket.future) return false;
    const status = calendarDeltaStatus(bucket);
    return status === "partial" || status === "unknown";
  });
  if (hasIncompletePastBucket) return "partial";
  if (!overview.endValuation || !overview.deltaComplete) return "partial";
  return "complete";
}
