import { describe, expect, test } from "bun:test";
import { userProfile } from "../../src/application/profile";
import { buildAccountValueTrend, buildWealthOverview } from "../../src/application/view-models";
import { Account, accountId } from "../../src/domain/accounts";
import { Asset, assetId } from "../../src/domain/assets";
import { UtcTimestamp } from "../../src/domain/core";
import {
  LedgerTransaction,
  replayLedger,
  transactionId,
  transactionLegId,
} from "../../src/domain/ledger";
import type { PriceQuote } from "../../src/domain/valuation";

const at = (value: string) => UtcTimestamp.parse(value);

const broker = Account.create({
  id: accountId("account:broker"),
  name: "Broker",
  kind: "broker",
  ownership: "owned",
  includeInNetWorth: true,
});
const bank = Account.create({
  id: accountId("account:bank"),
  name: "Bank",
  kind: "bank",
  ownership: "owned",
  includeInNetWorth: true,
});
const external = Account.create({
  id: accountId("account:external"),
  name: "Market Counterparty",
  kind: "external",
  ownership: "external",
  includeInNetWorth: false,
});
const eur = Asset.create({
  id: assetId("asset:eur"),
  symbol: "EUR",
  name: "Euro",
  kind: "fiat",
  precision: 2,
  fiatCurrency: "EUR",
});

function deposit(
  suffix: string,
  occurredAt: string,
  account: typeof broker,
  quantity: string,
): LedgerTransaction {
  return LedgerTransaction.create({
    id: transactionId(`tx:${suffix}`),
    occurredAt: at(occurredAt),
    recordedAt: at(occurredAt),
    description: suffix,
    legs: [
      {
        id: transactionLegId(`leg:${suffix}-owned`),
        accountId: account.id,
        assetId: eur.id,
        quantity,
      },
      {
        id: transactionLegId(`leg:${suffix}-external`),
        accountId: external.id,
        assetId: eur.id,
        quantity: `-${quantity}`,
      },
    ],
  });
}

function overviewFor(transactions: readonly LedgerTransaction[]) {
  const accounts = [broker, bank, external];
  const assets = [eur];
  return buildWealthOverview({
    profile: userProfile({
      displayName: "Adam",
      baseCurrency: "EUR",
      locale: "it-IT",
      onboarded: true,
    }),
    accounts,
    assets,
    transactions: [...transactions],
    priceQuotes: [] as PriceQuote[],
    fxRates: [],
    snapshot: replayLedger({ accounts, assets, transactions: [...transactions] }),
  });
}

describe("account value trend", () => {
  test("isolates one account instead of plotting total net worth", () => {
    const overview = overviewFor([
      deposit("broker-june", "2026-06-10T10:00:00Z", broker, "1000"),
      deposit("bank-june", "2026-06-12T10:00:00Z", bank, "500"),
      deposit("broker-july", "2026-07-10T10:00:00Z", broker, "200"),
    ]);

    const points = buildAccountValueTrend(overview, {
      accountId: broker.id.toString(),
      now: new Date("2026-08-15T12:00:00Z"),
    });

    expect(points.map((point) => point.key)).toEqual(["2026-06", "2026-07", "2026-08"]);
    expect(points.map((point) => point.knownValue.amount.toString())).toEqual([
      "1000",
      "1200",
      "1200",
    ]);
    expect(points.every((point) => point.complete)).toBe(true);
  });

  test("never plots a cutoff beyond now", () => {
    const overview = overviewFor([deposit("broker-june", "2026-06-10T10:00:00Z", broker, "1000")]);
    const now = new Date("2026-06-20T12:00:00Z");

    const points = buildAccountValueTrend(overview, {
      accountId: broker.id.toString(),
      now,
    });

    expect(points).toHaveLength(1);
    expect(points[0]?.at.getTime()).toBe(now.getTime());
  });

  test("does not fabricate a user-facing trend for an external account", () => {
    const overview = overviewFor([deposit("broker-june", "2026-06-10T10:00:00Z", broker, "1000")]);

    expect(
      buildAccountValueTrend(overview, {
        accountId: external.id.toString(),
        now: new Date("2026-08-15T12:00:00Z"),
      }),
    ).toHaveLength(0);
  });
});
