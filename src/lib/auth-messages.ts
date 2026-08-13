/**
 * Provider-neutral wording for sign-in and sign-up failures.
 *
 * Two rules hold everywhere:
 *  - a raw runtime or provider message is never shown to the user;
 *  - the most specific cause wins, so an unconfirmed email is never
 *    mis-reported as wrong credentials just because both arrive as HTTP 400.
 */

type AuthErrorShape = { status?: number; code?: string; message?: string; name?: string };

function read(error: unknown): AuthErrorShape {
  if (typeof error !== "object" || error === null) return {};
  const candidate = error as AuthErrorShape;
  return {
    status: typeof candidate.status === "number" ? candidate.status : undefined,
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    message: typeof candidate.message === "string" ? candidate.message : undefined,
    name: typeof candidate.name === "string" ? candidate.name : undefined,
  };
}

export type AuthFailure = Readonly<{
  message: string;
  /** True when the account exists but the address has not been confirmed. */
  needsEmailConfirmation: boolean;
}>;

export function classifyAuthFailure(error: unknown, fallback: string): AuthFailure {
  const { status, code, message = "", name = "" } = read(error);
  const unreachable =
    status === 404 ||
    status === 0 ||
    name === "AuthRetryableFetchError" ||
    /failed to fetch|networkerror|network request failed/i.test(message);

  if (unreachable) {
    return {
      message: "We couldn't reach the sign-in service. Check your connection and try again.",
      needsEmailConfirmation: false,
    };
  }

  // Checked before any generic 400 handling: both arrive with the same status.
  if (code === "email_not_confirmed" || /email not confirmed/i.test(message)) {
    return {
      message:
        "Your email address hasn't been confirmed yet. Open the confirmation link we sent you, then sign in.",
      needsEmailConfirmation: true,
    };
  }

  if (code === "user_already_exists" || /already registered|already exists/i.test(message)) {
    return {
      message: "An account already exists for this email. Try signing in instead.",
      needsEmailConfirmation: false,
    };
  }

  if (code === "weak_password" || /password should be|weak password/i.test(message)) {
    return {
      message: "That password is too weak. Use at least 6 characters and try again.",
      needsEmailConfirmation: false,
    };
  }

  if (status === 429 || code === "over_request_rate_limit" || /rate limit/i.test(message)) {
    return {
      message: "Too many attempts. Please wait a moment and try again.",
      needsEmailConfirmation: false,
    };
  }

  if (code === "invalid_credentials" || /invalid login credentials/i.test(message)) {
    return {
      message: "That email and password don't match. Please try again.",
      needsEmailConfirmation: false,
    };
  }

  if (status === 400 || status === 401 || status === 422) {
    return {
      message: "We couldn't verify those details. Check them and try again.",
      needsEmailConfirmation: false,
    };
  }

  return { message: fallback, needsEmailConfirmation: false };
}
