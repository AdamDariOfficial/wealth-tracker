import { DomainError } from "./domain-error";

const ENTITY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export class EntityIdError extends DomainError {
  readonly code = "ENTITY_ID_ERROR";

  constructor(input: string) {
    super(`Entity ID must contain 1-128 safe ASCII characters; received ${JSON.stringify(input)}.`);
  }
}

export class EntityId<TKind extends string> {
  readonly #value: string;
  declare readonly __kind: TKind;

  private constructor(value: string) {
    this.#value = value;
    Object.freeze(this);
  }

  static parse<TKind extends string>(input: string): EntityId<TKind> {
    if (input.trim() !== input || !ENTITY_ID_PATTERN.test(input)) {
      throw new EntityIdError(input);
    }

    return new EntityId<TKind>(input);
  }

  equals(other: EntityId<TKind>): boolean {
    return this.#value === other.#value;
  }

  toString(): string {
    return this.#value;
  }

  toJSON(): string {
    return this.#value;
  }
}
