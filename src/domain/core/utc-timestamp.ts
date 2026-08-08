import { DomainError } from "./domain-error";

const ISO_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;

export class UtcTimestampError extends DomainError {
  readonly code = "UTC_TIMESTAMP_ERROR";

  constructor(input: string) {
    super(`Timestamp must be a valid ISO-8601 instant; received ${JSON.stringify(input)}.`);
  }
}

function assertCalendarComponents(match: RegExpExecArray, input: string): void {
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const milliseconds = Number((match[7] ?? "").padEnd(3, "0"));
  const zone = match[8];

  const probe = new Date(0);
  probe.setUTCFullYear(year, month - 1, day);
  probe.setUTCHours(hour, minute, second, milliseconds);

  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day ||
    probe.getUTCHours() !== hour ||
    probe.getUTCMinutes() !== minute ||
    probe.getUTCSeconds() !== second ||
    probe.getUTCMilliseconds() !== milliseconds
  ) {
    throw new UtcTimestampError(input);
  }

  if (zone !== "Z") {
    const offsetHour = Number(zone.slice(1, 3));
    const offsetMinute = Number(zone.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) {
      throw new UtcTimestampError(input);
    }
  }
}

export class UtcTimestamp {
  readonly #value: string;
  readonly #epochMilliseconds: number;

  private constructor(value: string, epochMilliseconds: number) {
    this.#value = value;
    this.#epochMilliseconds = epochMilliseconds;
    Object.freeze(this);
  }

  static parse(input: string): UtcTimestamp {
    const match = ISO_INSTANT_PATTERN.exec(input);
    if (input.trim() !== input || !match) {
      throw new UtcTimestampError(input);
    }

    assertCalendarComponents(match, input);
    const epochMilliseconds = Date.parse(input);
    if (!Number.isFinite(epochMilliseconds)) {
      throw new UtcTimestampError(input);
    }

    return new UtcTimestamp(new Date(epochMilliseconds).toISOString(), epochMilliseconds);
  }

  static fromDate(value: Date): UtcTimestamp {
    const epochMilliseconds = value.getTime();
    if (!Number.isFinite(epochMilliseconds)) {
      throw new UtcTimestampError(value.toString());
    }

    return new UtcTimestamp(new Date(epochMilliseconds).toISOString(), epochMilliseconds);
  }

  compare(other: UtcTimestamp): -1 | 0 | 1 {
    if (this.#epochMilliseconds < other.#epochMilliseconds) return -1;
    if (this.#epochMilliseconds > other.#epochMilliseconds) return 1;
    return 0;
  }

  equals(other: UtcTimestamp): boolean {
    return this.#epochMilliseconds === other.#epochMilliseconds;
  }

  toEpochMilliseconds(): number {
    return this.#epochMilliseconds;
  }

  toString(): string {
    return this.#value;
  }

  toJSON(): string {
    return this.#value;
  }
}
