import { describe, expect, test } from "bun:test";
import { parseLedgerImport } from "../../src/application/imports";
import { userProfile } from "../../src/application/profile";
import { Account, accountId } from "../../src/domain/accounts";
import { Asset, assetId } from "../../src/domain/assets";
import { replayLedger } from "../../src/domain/ledger";

function state() {
  const bank = Account.create({
    id: accountId("account:bank"),
    name: "Bank",
    kind: "bank",
    ownership: "owned",
    includeInNetWorth: true,
  });
  const income = Account.create({
    id: accountId("account:income"),
    name: "Income",
    kind: "income",
    ownership: "system",
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
  const accounts = [bank, income];
  const assets = [eur];
  const transactions = [];
  return {
    profile: userProfile({
      displayName: "Adam",
      baseCurrency: "EUR",
      locale: "it-IT",
      onboarded: true,
    }),
    accounts,
    assets,
    transactions,
    priceQuotes: [],
    fxRates: [],
    snapshot: replayLedger({ accounts, assets, transactions }),
  };
}

const header =
  "transaction_id,leg_id,occurred_at,recorded_at,description,account_id,asset_id,quantity,memo";

describe("Phase 4 ledger CSV import", () => {
  test("parses exact decimal quantities into one balanced canonical transaction", () => {
    const source = [
      header,
      "tx:salary,leg:bank,2026-08-10T08:00:00Z,2026-08-10T08:00:01Z,Salary,account:bank,asset:eur,9007199254740993.01,",
      "tx:salary,leg:income,2026-08-10T08:00:00Z,2026-08-10T08:00:01Z,Salary,account:income,asset:eur,-9007199254740993.01,",
    ].join("\n");

    const preview = parseLedgerImport(source, state());
    expect(preview.issues).toEqual([]);
    expect(preview.transactionCount).toBe(1);
    expect(preview.legCount).toBe(2);
    expect(preview.transactions[0].legs[0].quantity.toString()).toBe("9007199254740993.01");
    expect(preview.transactions[0].legs[1].quantity.toString()).toBe("-9007199254740993.01");
  });

  test("reports row-level unknown references before commit", () => {
    const source = [
      header,
      "tx:salary,leg:bank,2026-08-10T08:00:00Z,2026-08-10T08:00:01Z,Salary,account:missing,asset:eur,10,",
      "tx:salary,leg:income,2026-08-10T08:00:00Z,2026-08-10T08:00:01Z,Salary,account:income,asset:eur,-10,",
    ].join("\n");

    const preview = parseLedgerImport(source, state());
    expect(
      preview.issues.some((issue) => issue.line === 2 && /Unknown account_id/.test(issue.message)),
    ).toBe(true);
  });

  test("rejects an unbalanced grouped transaction", () => {
    const source = [
      header,
      "tx:bad,leg:bank,2026-08-10T08:00:00Z,2026-08-10T08:00:01Z,Bad,account:bank,asset:eur,10,",
      "tx:bad,leg:income,2026-08-10T08:00:00Z,2026-08-10T08:00:01Z,Bad,account:income,asset:eur,-5,",
    ].join("\n");

    const preview = parseLedgerImport(source, state());
    expect(preview.issues.some((issue) => /not balanced/.test(issue.message))).toBe(true);
  });

  test("requires the exact canonical header", () => {
    const preview = parseLedgerImport("transaction_id,quantity\ntx:x,1", state());
    expect(preview.issues[0]?.message).toContain("Header must be exactly");
  });
});
