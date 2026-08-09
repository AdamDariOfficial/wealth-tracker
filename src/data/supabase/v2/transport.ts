import { supabase } from "../../../integrations/supabase/client";

export type RpcArguments = Readonly<Record<string, unknown>>;

export interface V2Transport {
  rpc<T>(name: string, args?: RpcArguments): Promise<T>;
  getAuthenticatedUser(): Promise<Readonly<{ id: string; email: string | null }> | null>;
}

type RuntimeError = Readonly<{
  code?: string;
  message?: string;
}>;

type RuntimeClient = Readonly<{
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<Readonly<{ data: unknown; error: RuntimeError | null }>>;
  auth: Readonly<{
    getUser: () => PromiseLike<
      Readonly<{
        data: Readonly<{ user: Readonly<{ id: string; email?: string | null }> | null }>;
        error: RuntimeError | null;
      }>
    >;
  }>;
}>;

export class SupabaseV2RepositoryError extends Error {
  readonly code = "SUPABASE_V2_REPOSITORY_ERROR";
  readonly operation: string;
  readonly databaseCode: string | null;

  constructor(operation: string, cause: RuntimeError | unknown) {
    super(`Persistence operation failed: ${operation}.`, { cause });
    this.name = new.target.name;
    this.operation = operation;
    this.databaseCode =
      typeof cause === "object" && cause !== null && "code" in cause
        ? String((cause as RuntimeError).code ?? "") || null
        : null;
  }
}

export class SupabaseV2Transport implements V2Transport {
  readonly #client: RuntimeClient;

  constructor(client: RuntimeClient = supabase as unknown as RuntimeClient) {
    this.#client = client;
  }

  async rpc<T>(name: string, args: RpcArguments = {}): Promise<T> {
    const result = await this.#client.rpc(name, { ...args });
    if (result.error) {
      throw new SupabaseV2RepositoryError(`rpc:${name}`, result.error);
    }
    return result.data as T;
  }

  async getAuthenticatedUser(): Promise<Readonly<{ id: string; email: string | null }> | null> {
    const result = await this.#client.auth.getUser();
    if (result.error) {
      throw new SupabaseV2RepositoryError("auth:getUser", result.error);
    }
    if (!result.data.user) return null;
    return Object.freeze({
      id: result.data.user.id,
      email: result.data.user.email ?? null,
    });
  }
}
