export type AuthUserId = string & { readonly __authUserId: unique symbol };

export type AuthenticatedUser = Readonly<{
  id: AuthUserId;
  email: string | null;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AuthIdentityError extends Error {
  readonly code = "AUTH_IDENTITY_ERROR";

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export function authUserId(input: string): AuthUserId {
  if (!UUID_PATTERN.test(input)) {
    throw new AuthIdentityError("Authenticated user ID must be a valid UUID.");
  }

  return input.toLowerCase() as AuthUserId;
}
