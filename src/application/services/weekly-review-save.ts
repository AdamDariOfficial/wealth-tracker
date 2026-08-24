import type { WeeklyReviewInput } from "../advanced";
import { normalizeWeeklyReview } from "./advanced-service";

export interface AtomicWeeklyReviewWriter {
  saveWeeklyReview(input: WeeklyReviewInput, finalize: boolean): Promise<void>;
}

export async function saveValidatedWeeklyReview(
  repository: AtomicWeeklyReviewWriter,
  input: WeeklyReviewInput,
  finalize: boolean,
): Promise<void> {
  await repository.saveWeeklyReview(normalizeWeeklyReview(input), finalize);
}
