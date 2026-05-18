/**
 * Synthetic data generator for development & QA.
 *
 * Generates realistic accounts, assets and a multi-month transaction stream so
 * the dashboard, analytics and holdings views can be validated end-to-end.
 * The DB trigger `recompute_account_balance` keeps account balances in sync
 * automatically — we never write balances directly.
 */
import { supabase } from "@/integrations/supabase/client";

type ID = string;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick = <T,>(arr: T[]) => arr[randInt(0, arr.length - 1)];
const roundTo = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

const ACCOUNT_BLUEPRINT: Array<{
  name: string;
  type: "bank" | "exchange" | "broker" | "crypto_wallet" | "cold_wallet" | "cash" | "savings" | "investment";
  provider: string;
  currency: string;
  color: string;
}> = [
  { name: "Main Checking",      type: "bank",          provider: "Revolut",     currency: "USD", color: "#22d3ee" },
  { name: "EU Savings",         type: "savings",       provider: "N26",         currency: "EUR", color: "#10b981" },
  { name: "Wallet Cash",        type: "cash",          provider: "Cash",        currency: "USD", color: "#f59e0b" },
  { name: "Binance",            type: "exchange",      provider: "Binance",     currency: "USD", color: "#f7931a" },
  { name: "Coinbase",           type: "exchange",      provider: "Coinbase",    currency: "USD", color: "#3b82f6" },
  { name: "Ledger",             type: "cold_wallet",   provider: "Ledger",      currency: "USD", color: "#a855f7" },
  { name: "IBKR Broker",        type: "broker",        provider: "IBKR",        currency: "USD", color: "#ef4444" },
  { name: "Trading212",         type: "broker",        provider: "Trading212",  currency: "EUR", color: "#84cc16" },
];

const ASSET_BLUEPRINT: Array<{
  symbol: string; name: string; asset_class: "fiat" | "crypto" | "etf" | "stock" | "stablecoin";
  current_price: number; color: string;
}> = [
  { symbol: "USD",  name: "US Dollar",       asset_class: "fiat",       current_price: 1,       color: "#10b981" },
  { symbol: "EUR",  name: "Euro",            asset_class: "fiat",       current_price: 1.08,    color: "#3b82f6" },
  { symbol: "USDT", name: "Tether",          asset_class: "stablecoin", current_price: 1,       color: "#26a17b" },
  { symbol: "BTC",  name: "Bitcoin",         asset_class: "crypto",     current_price: 96000,   color: "#f7931a" },
  { symbol: "ETH",  name: "Ethereum",        asset_class: "crypto",     current_price: 3400,    color: "#627eea" },
  { symbol: "SOL",  name: "Solana",          asset_class: "crypto",     current_price: 185,     color: "#9945ff" },
  { symbol: "VWCE", name: "Vanguard FTSE All-World", asset_class: "etf", current_price: 128,    color: "#0ea5e9" },
  { symbol: "CSPX", name: "iShares Core S&P 500",     asset_class: "etf", current_price: 545,   color: "#8b5cf6" },
  { symbol: "AAPL", name: "Apple Inc.",       asset_class: "stock",     current_price: 232,     color: "#a3a3a3" },
  { symbol: "NVDA", name: "NVIDIA Corp.",     asset_class: "stock",     current_price: 138,     color: "#76b900" },
];

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

/** Wipe all ledger data for the current user. Auth/profile rows are preserved. */
export async function resetUserData(): Promise<void> {
  const user_id = await currentUserId();
  // Order matters — clear children before parents.
  const tables = [
    "audit_log",
    "transactions",
    "dca_plans",
    "portfolio_snapshots_v2",
    "performance_snapshots",
    "weekly_reports",
    "trades",
    "investments",
    "etfs",
    "crypto_holdings",
    "cash_reserves",
    "goals",
    "accounts",
    "assets",
  ];
  for (const t of tables) {
    const { error } = await (supabase as any).from(t).delete().eq("user_id", user_id);
    if (error && !/no rows/i.test(error.message)) {
      // continue — some tables may already be empty
      console.warn(`reset ${t}`, error.message);
    }
  }
}

type SeedOptions = {
  /** How many months of history to generate. Default 9. */
  months?: number;
  /** Roughly how many transactions to insert. Default 220. */
  transactions?: number;
};

export type SeedResult = {
  accounts: number;
  assets: number;
  transactions: number;
};

/** Seed a realistic multi-month portfolio for the current user. */
export async function seedRealisticPortfolio(opts: SeedOptions = {}): Promise<SeedResult> {
  const user_id = await currentUserId();
  const months = opts.months ?? 9;
  const targetTx = opts.transactions ?? 220;

  // 1. Accounts ------------------------------------------------------------
  const accountRows = ACCOUNT_BLUEPRINT.map((a) => ({ ...a, user_id }));
  const { data: insertedAccounts, error: accErr } = await (supabase as any)
    .from("accounts").insert(accountRows).select("*");
  if (accErr) throw accErr;
  const accounts = insertedAccounts as Array<{ id: ID; name: string; type: string; currency: string }>;

  const byName = (n: string) => accounts.find((a) => a.name === n)!;
  const checking = byName("Main Checking");
  const savings = byName("EU Savings");
  const cash = byName("Wallet Cash");
  const binance = byName("Binance");
  const coinbase = byName("Coinbase");
  const ledger = byName("Ledger");
  const ibkr = byName("IBKR Broker");
  const t212 = byName("Trading212");
  const cryptoExchanges = [binance, coinbase];
  const brokers = [ibkr, t212];

  // 2. Assets --------------------------------------------------------------
  // handle_new_user() may have pre-seeded USD/EUR/BTC/ETH/SOL — upsert by (user, symbol).
  const existing = await (supabase as any).from("assets").select("id,symbol").eq("user_id", user_id);
  const existingMap = new Map<string, ID>((existing.data ?? []).map((a: any) => [a.symbol, a.id]));
  const toInsert = ASSET_BLUEPRINT.filter((a) => !existingMap.has(a.symbol)).map((a) => ({ ...a, user_id }));
  let createdAssets = 0;
  if (toInsert.length) {
    const { data, error } = await (supabase as any).from("assets").insert(toInsert).select("id,symbol,current_price");
    if (error) throw error;
    for (const r of data as any[]) existingMap.set(r.symbol, r.id);
    createdAssets = data.length;
  }
  // Also bump prices on the pre-seeded ones so they aren't zero.
  for (const a of ASSET_BLUEPRINT) {
    const id = existingMap.get(a.symbol);
    if (!id) continue;
    await (supabase as any).from("assets").update({ current_price: a.current_price, color: a.color, name: a.name, asset_class: a.asset_class }).eq("id", id);
  }
  const assetId = (sym: string) => existingMap.get(sym)!;
  const priceOf = (sym: string) => ASSET_BLUEPRINT.find((a) => a.symbol === sym)!.current_price;

  // 3. Transactions --------------------------------------------------------
  const now = Date.now();
  const startMs = now - months * 30 * 24 * 60 * 60 * 1000;
  const txs: any[] = [];

  // Seed each account with an opening deposit so balances aren't negative.
  txs.push(tx("deposit", { dest: checking.id, asset: assetId("USD"), qty: 12000, fiat: 12000, ts: startMs }));
  txs.push(tx("deposit", { dest: savings.id,  asset: assetId("EUR"), qty: 8000,  fiat: 8000 * 1.08, ts: startMs + dayMs(1) }));
  txs.push(tx("deposit", { dest: cash.id,     asset: assetId("USD"), qty: 600,   fiat: 600, ts: startMs + dayMs(1) }));

  // Monthly salary
  for (let m = 0; m < months; m++) {
    const ts = startMs + (m * 30 + 1) * dayMs(1) + rand(0, dayMs(1));
    txs.push(tx("deposit", {
      dest: checking.id, asset: assetId("USD"), qty: 4500, fiat: 4500, ts,
      note: "Salary", tags: ["income", "salary"],
    }));
  }

  // Distribute remaining transactions across the window
  while (txs.length < targetTx) {
    const ts = rand(startMs + dayMs(3), now);
    const r = Math.random();

    if (r < 0.18) {
      // Transfer cash between fiat accounts
      const from = pick([checking, savings, cash]);
      const to = pick([checking, savings, cash, binance, coinbase, ibkr, t212].filter((a) => a.id !== from.id));
      const amt = roundTo(rand(50, 1500));
      txs.push(tx("transfer", {
        src: from.id, dest: to.id, asset: assetId(from.currency), qty: amt, fiat: amt, ts,
        note: `Transfer to ${to.name}`,
      }));
    } else if (r < 0.55) {
      // Crypto buy
      const ex = pick(cryptoExchanges);
      const sym = pick(["BTC", "ETH", "SOL"]);
      const px = priceOf(sym) * rand(0.85, 1.15);
      const qty = roundTo(rand(0.005, sym === "BTC" ? 0.05 : sym === "ETH" ? 0.5 : 5), 6);
      const fiat = roundTo(qty * px);
      const fee = roundTo(fiat * rand(0.001, 0.004), 2);
      txs.push(tx("buy", {
        src: checking.id, dest: ex.id, asset: assetId(sym),
        qty, fiat, fee, rate: px, ts, note: `Buy ${sym}`,
      }));
    } else if (r < 0.7) {
      // Crypto sell (sometimes)
      const ex = pick(cryptoExchanges);
      const sym = pick(["BTC", "ETH", "SOL"]);
      const px = priceOf(sym) * rand(0.9, 1.2);
      const qty = roundTo(rand(0.001, sym === "BTC" ? 0.01 : 0.1), 6);
      const fiat = roundTo(qty * px);
      txs.push(tx("sell", {
        src: ex.id, dest: checking.id, asset: assetId(sym),
        qty, fiat, fee: roundTo(fiat * 0.002, 2), rate: px, ts, note: `Sell ${sym}`,
      }));
    } else if (r < 0.85) {
      // ETF / stock buy via broker
      const br = pick(brokers);
      const sym = pick(["VWCE", "CSPX", "AAPL", "NVDA"]);
      const px = priceOf(sym) * rand(0.9, 1.1);
      const qty = roundTo(rand(1, 8), 0);
      const fiat = roundTo(qty * px);
      txs.push(tx("buy", {
        src: checking.id, dest: br.id, asset: assetId(sym),
        qty, fiat, fee: 1, rate: px, ts, note: `Buy ${sym}`,
      }));
    } else if (r < 0.92) {
      // Dividend
      const br = pick(brokers);
      const sym = pick(["VWCE", "CSPX", "AAPL"]);
      const fiat = roundTo(rand(5, 80));
      txs.push(tx("dividend", {
        dest: br.id, asset: assetId(sym), qty: 0, fiat, ts, note: `${sym} dividend`,
      }));
    } else if (r < 0.96) {
      // Transfer crypto to cold storage
      const sym = pick(["BTC", "ETH"]);
      const qty = roundTo(rand(0.001, 0.02), 6);
      txs.push(tx("transfer", {
        src: pick(cryptoExchanges).id, dest: ledger.id, asset: assetId(sym),
        qty, fiat: roundTo(qty * priceOf(sym)), ts, note: "Cold storage",
      }));
    } else {
      // Withdrawal / spending
      txs.push(tx("withdrawal", {
        src: checking.id, asset: assetId("USD"),
        qty: roundTo(rand(20, 400)), fiat: roundTo(rand(20, 400)), ts, note: "Spending",
      }));
    }
  }

  // Insert in chunks of 100 to avoid payload limits.
  const sorted = txs.sort((a, b) => +new Date(a.execution_timestamp) - +new Date(b.execution_timestamp))
    .map((t) => ({ ...t, user_id }));
  for (let i = 0; i < sorted.length; i += 100) {
    const chunk = sorted.slice(i, i + 100);
    const { error } = await (supabase as any).from("transactions").insert(chunk);
    if (error) throw error;
  }

  return { accounts: accountRows.length, assets: createdAssets, transactions: sorted.length };
}

function dayMs(n: number) { return n * 24 * 60 * 60 * 1000; }

function tx(
  type: string,
  p: {
    src?: ID; dest?: ID; asset?: ID;
    qty: number; fiat: number; fee?: number; rate?: number;
    ts: number; note?: string; tags?: string[];
  },
): any {
  return {
    transaction_type: type,
    source_account_id: p.src ?? null,
    destination_account_id: p.dest ?? null,
    asset_id: p.asset ?? null,
    quantity: p.qty,
    fiat_value: p.fiat,
    fee_amount: p.fee ?? 0,
    exchange_rate: p.rate ?? null,
    execution_timestamp: new Date(p.ts).toISOString(),
    note: p.note ?? null,
    tags: p.tags ?? [],
  };
}

/** Reconciliation check: recompute every account balance from the ledger and
 *  compare to what's stored in accounts.current_balance. */
export type ReconciliationRow = {
  accountId: string;
  accountName: string;
  stored: number;
  computed: number;
  delta: number;
};

export async function runReconciliation(): Promise<ReconciliationRow[]> {
  const user_id = await currentUserId();
  const [{ data: accounts }, { data: txs }] = await Promise.all([
    (supabase as any).from("accounts").select("id,name,current_balance").eq("user_id", user_id),
    (supabase as any).from("transactions").select("*").eq("user_id", user_id),
  ]);

  const balances = new Map<string, number>();
  for (const a of accounts ?? []) balances.set(a.id, 0);

  for (const t of (txs ?? []) as any[]) {
    const f = Number(t.fiat_value ?? 0);
    const src = t.source_account_id as string | null;
    const dst = t.destination_account_id as string | null;
    switch (t.transaction_type) {
      case "deposit": case "interest": case "dividend":
      case "staking_reward": case "profit_realization":
        if (dst) balances.set(dst, (balances.get(dst) ?? 0) + f);
        break;
      case "withdrawal": case "fee":
        if (src) balances.set(src, (balances.get(src) ?? 0) - f);
        break;
      case "buy":
        if (src) balances.set(src, (balances.get(src) ?? 0) - f);
        break;
      case "sell":
        if (dst) balances.set(dst, (balances.get(dst) ?? 0) + f);
        break;
      case "transfer":
        if (src) balances.set(src, (balances.get(src) ?? 0) - f);
        if (dst) balances.set(dst, (balances.get(dst) ?? 0) + f);
        break;
      case "manual_adjustment":
        if (dst) balances.set(dst, (balances.get(dst) ?? 0) + f);
        break;
    }
  }

  return (accounts ?? []).map((a: any): ReconciliationRow => {
    const stored = Number(a.current_balance ?? 0);
    const computed = balances.get(a.id) ?? 0;
    return {
      accountId: a.id,
      accountName: a.name,
      stored: roundTo(stored, 2),
      computed: roundTo(computed, 2),
      delta: roundTo(computed - stored, 2),
    };
  });
}
