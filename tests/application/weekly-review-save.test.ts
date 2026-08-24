import { describe, expect, test } from "bun:test";
import type { WeeklyReviewInput } from "../../src/application/advanced";
import {
  type AtomicWeeklyReviewWriter,
  saveValidatedWeeklyReview,
} from "../../src/application/services/weekly-review-save";

const input = {
  id: "review:2026-08-17",
  weekStart: "2026-08-17",
  reportedPnl: "100.00",
  winRate: "60",
  avgRr: "2",
  tradeCount: 5,
  maxDrawdownPct: "3",
  disciplineScore: 80,
  psychologyScore: 75,
  notes: null,
  lessons: null,
} satisfies WeeklyReviewInput;

describe("atomic weekly save adapter", () => {
  test("passes normalized review and final choice in one repository call", async () => {
    const calls: Array<{ review: WeeklyReviewInput; finalize: boolean }> = [];
    const writer: AtomicWeeklyReviewWriter = {
      async saveWeeklyReview(review, finalize) {
        calls.push({ review, finalize });
      },
    };

    await saveValidatedWeeklyReview(writer, input, true);

    expect(calls).toHaveLength(1);
    const firstCall = calls.at(0);
    expect(firstCall?.finalize).toBe(true);
    expect(firstCall?.review.reportedPnl).toBe("100");
  });

  test("draft choice remains explicit", async () => {
    let choice = true;
    const writer: AtomicWeeklyReviewWriter = {
      async saveWeeklyReview(_review, finalize) {
        choice = finalize;
      },
    };

    await saveValidatedWeeklyReview(writer, input, false);
    expect(choice).toBe(false);
  });
});
