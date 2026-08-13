import { DomainError } from "@/domain/core";

/**
 * Turns a thrown value into something worth showing a person.
 *
 * Domain errors are written for the user — "Every asset total must balance to
 * zero" is exactly the sentence they need. Everything else (transport,
 * repository, runtime) is an implementation detail: it leaks internals, reads
 * as noise, and never tells anyone what to do next. Those get the caller's
 * plain-language fallback instead.
 */
export function describeActionError(error: unknown, fallback: string): string {
  if (error instanceof DomainError && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}
