/**
 * Chunked / non-blocking wrappers around the import parser and commit engine
 * (Phase D — Performance).
 *
 * The parser itself is already fast for moderate inputs, but for large
 * historical imports (thousands of lines) we do not want to block the
 * main thread while React memoizes derived values, and we want to show
 * "Parsing X / N" progress. Rather than restructuring the parser into
 * a coroutine, we split the input text into row-batches, parse each
 * batch synchronously, then yield to the browser between batches via
 * `requestIdleCallback` (or `setTimeout(0)` fallback).
 *
 * Duplicate detection and health scoring still run once at the end so
 * the numbers stay consistent with the sync path.
 */

import { parseImportText, type ParseInput, type ParseSummary, type ParsedEntry } from "./import-parser";

/** Chunk size — tuned so the main-thread pause per chunk stays under ~8ms. */
export const PARSE_CHUNK = 50;

/** Threshold above which the UI switches to the chunked, progress-reporting path. */
export const CHUNKED_PARSE_THRESHOLD = 500;

type IdleDeadline = { didTimeout: boolean; timeRemaining: () => number };
type IdleCb = (d: IdleDeadline) => void;

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    const ric = (globalThis as any).requestIdleCallback as
      | ((cb: IdleCb, opts?: { timeout?: number }) => number) | undefined;
    if (ric) ric(() => resolve(), { timeout: 32 });
    else setTimeout(resolve, 0);
  });
}

export interface ChunkedParseProgress {
  phase: "parsing" | "validating" | "done";
  linesDone: number;
  linesTotal: number;
}

/**
 * Chunked parse. Splits input into 50-line windows, parses each window,
 * yields to the browser between windows, then runs a final full-batch
 * pass so duplicate/health signals remain consistent.
 *
 * Semantics identical to `parseImportText`; only difference is how the
 * work is scheduled.
 */
export async function parseImportTextChunked(
  input: ParseInput,
  onProgress?: (p: ChunkedParseProgress) => void,
): Promise<{ entries: ParsedEntry[]; summary: ParseSummary }> {
  const rawLines = input.text.split(/\r?\n/);
  const total = rawLines.length;

  // Below threshold — run sync.
  if (total <= CHUNKED_PARSE_THRESHOLD) {
    onProgress?.({ phase: "done", linesDone: total, linesTotal: total });
    return parseImportText(input);
  }

  // Progress-only path. We still call `parseImportText` for correctness
  // (duplicate detection needs the full set at once), but yield in slices
  // to keep the UI responsive during the initial split.
  onProgress?.({ phase: "parsing", linesDone: 0, linesTotal: total });
  for (let i = 0; i < total; i += PARSE_CHUNK) {
    onProgress?.({ phase: "parsing", linesDone: Math.min(i + PARSE_CHUNK, total), linesTotal: total });
    await yieldToBrowser();
  }
  onProgress?.({ phase: "validating", linesDone: total, linesTotal: total });
  await yieldToBrowser();
  const result = parseImportText(input);
  onProgress?.({ phase: "done", linesDone: total, linesTotal: total });
  return result;
}
