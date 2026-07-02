/**
 * Deterministic natural-language financial import parser (v2).
 * NO AI / NO LLMs — pure tokenizer + regex grammar.
 *
 * Supported operations (all flow through the existing ledger / holdings / goals
 * engines via src/lib/import-engine.ts — this layer ONLY produces structured
 * intents, it never writes anything):
 *
 *   Treasury
 *     +240 Cash Wallet, salary
 *     -50 Isy Bank, groceries
 *   Transfers
 *     250 Cash Wallet -> Isy Bank
 *   Buys / Sells (with optional price)
 *     BUY 2 BTC @ 42000 from Isy Bank
 *     BUY 2 BTC at 42000 from Isy Bank
 *     BUY BTC qty 2 price 42000 from Isy Bank
 *     BUY 1000 BTC from Isy Bank             (capital-only, qty derived if price known)
 *     SELL 0.5 BTC @ 65000 to Isy Bank
 *   Goals
 *     GOAL Emergency Fund target 10000
 *     500 -> GOAL Emergency Fund
 *   Opening balances / positions / snapshot
 *     ACCOUNT Cash Wallet balance 1375
 *     ASSET BTC qty 0.125 avg 42000
 *
 *   Natural-language phrasings ("Bought 2 BTC at 42000 from Isy Bank",
 *   "Invested 500 into VWCE", "Added 300 to Emergency Fund",
 *   "Transferred 100 from Cash Wallet to Isy Bank") are normalized
 *   into the canonical forms above before parsing.
 */

export type ParsedKind =
  | "deposit"
  | "expense"
  | "transfer"
  | "buy"
  | "sell"
  | "goal_create"
  | "goal_contribution"
  | "account_open"
  | "asset_open"
  | "unknown";

export interface AccountRef {
  raw: string;
  matchedId: string | null;
  matchedName: string | null;
  confidence: number;
  candidates: { id: string; name: string; score: number }[];
}

export interface AssetRef {
  raw: string;          // symbol token as typed
  matchedId: string | null;
  matchedSymbol: string | null;
  confidence: number;
}

export interface GoalRef {
  raw: string;
  matchedId: string | null;
  matchedName: string | null;
  confidence: number;
}

export interface ParsedEntry {
  lineNo: number;
  raw: string;
  kind: ParsedKind;
  timestamp: string;
  amount: number;             // cash amount; for buy/sell == quantity*price; for asset_open == qty*avg
  // treasury / transfer
  account?: AccountRef;
  fromAccount?: AccountRef;
  toAccount?: AccountRef;
  // buy / sell / asset_open
  asset?: AssetRefExt;
  quantity?: number;
  price?: number;
  // goal_create / goal_contribution
  goal?: GoalRef;
  targetAmount?: number;      // for goal_create
  // shared
  description: string | null;
  category: string | null;
  warnings: string[];
  errors: string[];
  unresolvedAccounts: string[];
  unresolvedAssets: string[];
  unresolvedGoals: string[];
  severity: "ready" | "warning" | "error";
  confidence: number;
  confidenceTier: "high" | "medium" | "low";
  usedDefaultAccount?: boolean;
  /** account_open only: source name did not match an existing account — engine will create it. */
  willCreateAccount?: boolean;
  duplicateOf?: string | null;
  duplicateOfLine?: number;
  duplicateScore?: number;
  duplicateReasons?: string[];
}

export interface ParseSummary {
  total: number;
  deposits: number;
  expenses: number;
  transfers: number;
  buys: number;
  sells: number;
  goalCreates: number;
  goalContributions: number;
  accountOpens: number;
  assetOpens: number;
  inflow: number;
  outflow: number;
  net: number;
  errorCount: number;
  warningCount: number;
  duplicateCount?: number;
}

export interface AccountLike {
  id: string; name: string; type?: string; provider?: string | null;
}
export interface AssetLike {
  id: string; symbol: string; name?: string; current_price?: number; asset_class?: string;
  aliases?: string[] | null;
  isin?: string | null;
}
export interface GoalLike {
  id: string; name: string;
}

export interface ImportAlias {
  alias: string;
  entity_type: "account" | "asset" | "goal";
  entity_id: string;
}

export interface ParseInput {
  text: string;
  accounts: AccountLike[];
  assets?: AssetLike[];
  goals?: GoalLike[];
  defaultDate?: Date;
  aliases?: ImportAlias[];
  ignoredAccounts?: string[];
  ignoredAssets?: string[];
  ignoredGoals?: string[];
  defaultAccountId?: string;
  existingTransactions?: {
    id: string;
    execution_timestamp: string;
    fiat_value: number;
    source_account_id: string | null;
    destination_account_id: string | null;
    note: string | null;
  }[];
}

// ---------- normalization ----------
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
   .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s: string) => {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      out.set(bg, (out.get(bg) ?? 0) + 1);
    }
    return out;
  };
  const A = bigrams(a); const B = bigrams(b);
  let inter = 0, sizeA = 0, sizeB = 0;
  A.forEach((v) => (sizeA += v)); B.forEach((v) => (sizeB += v));
  A.forEach((v, k) => { const m = B.get(k); if (m) inter += Math.min(v, m); });
  return (2 * inter) / (sizeA + sizeB);
}

function resolveAccount(raw: string, accounts: AccountLike[], aliases?: ImportAlias[]): AccountRef {
  const target = norm(raw);
  if (!target) return { raw, matchedId: null, matchedName: null, confidence: 0, candidates: [] };
  if (aliases?.length) {
    const a = aliases.find((al) => al.entity_type === "account" && norm(al.alias) === target);
    if (a) {
      const acct = accounts.find((x) => x.id === a.entity_id);
      if (acct) return {
        raw, matchedId: acct.id, matchedName: acct.name, confidence: 1,
        candidates: [{ id: acct.id, name: acct.name, score: 1 }],
      };
    }
  }
  const scored = accounts.map((a) => {
    const n = norm(a.name);
    let score = 0;
    if (n === target) score = 1;
    else if (n.includes(target) || target.includes(n)) score = 0.85;
    else score = diceCoefficient(n, target);
    if (target === "cash" || target === "contanti" || target === "contante") {
      if (n.includes("cash") || n.includes("contant")) score = Math.max(score, 0.95);
    }
    return { id: a.id, name: a.name, score };
  });
  scored.sort((x, y) => y.score - x.score);
  const top = scored[0];
  const confident = top && top.score >= 0.6;
  return {
    raw, matchedId: confident ? top.id : null, matchedName: confident ? top.name : null,
    confidence: top?.score ?? 0, candidates: scored.slice(0, 5),
  };
}

export interface AssetRefExt extends AssetRef {
  /** non-null when the resolver found 2+ candidates above ambiguity threshold */
  alternatives?: { id: string; symbol: string; name: string; score: number }[];
}

function resolveAsset(raw: string, assets: AssetLike[] | undefined, aliases?: ImportAlias[]): AssetRefExt {
  const target = norm(raw);
  if (!target || !assets) return { raw, matchedId: null, matchedSymbol: null, confidence: 0 };

  // 1. user-defined import_alias rows (highest precedence)
  if (aliases?.length) {
    const a = aliases.find((al) => al.entity_type === "asset" && norm(al.alias) === target);
    if (a) {
      const ass = assets.find((x) => x.id === a.entity_id);
      if (ass) return { raw, matchedId: ass.id, matchedSymbol: ass.symbol, confidence: 1 };
    }
  }
  // 2. ISIN exact match
  const upperRaw = raw.trim().toUpperCase();
  const isinHit = assets.find((a) => (a.isin ?? "").toUpperCase() === upperRaw);
  if (isinHit) return { raw, matchedId: isinHit.id, matchedSymbol: isinHit.symbol, confidence: 1 };
  // 3. exact symbol match
  const symHit = assets.find((a) => norm(a.symbol) === target);
  if (symHit) return { raw, matchedId: symHit.id, matchedSymbol: symHit.symbol, confidence: 1 };
  // 4. asset-level aliases column (exact, normalized)
  const aliasHit = assets.find((a) => (a.aliases ?? []).some((al) => norm(al) === target));
  if (aliasHit) return { raw, matchedId: aliasHit.id, matchedSymbol: aliasHit.symbol, confidence: 0.98 };

  // 5. fuzzy by symbol / name / alias — keep alternatives within band
  const scored = assets.map((a) => {
    const sSym = diceCoefficient(norm(a.symbol), target);
    const sName = a.name ? diceCoefficient(norm(a.name), target) : 0;
    const sAlias = (a.aliases ?? []).reduce(
      (m, al) => Math.max(m, diceCoefficient(norm(al), target)), 0,
    );
    return { id: a.id, symbol: a.symbol, name: a.name ?? a.symbol, score: Math.max(sSym, sName, sAlias) };
  }).sort((x, y) => y.score - x.score);

  const best = scored[0];
  if (best && best.score >= 0.7) {
    const alts = scored.filter((s) => s.id !== best.id && s.score >= Math.max(0.6, best.score - 0.15)).slice(0, 3);
    return {
      raw, matchedId: best.id, matchedSymbol: best.symbol, confidence: best.score,
      alternatives: alts.length ? alts : undefined,
    };
  }
  return { raw, matchedId: null, matchedSymbol: null, confidence: best?.score ?? 0 };
}

function resolveGoal(raw: string, goals: GoalLike[] | undefined, aliases?: ImportAlias[]): GoalRef {
  const target = norm(raw);
  if (!target || !goals) return { raw, matchedId: null, matchedName: null, confidence: 0 };
  if (aliases?.length) {
    const a = aliases.find((al) => al.entity_type === "goal" && norm(al.alias) === target);
    if (a) {
      const g = goals.find((x) => x.id === a.entity_id);
      if (g) return { raw, matchedId: g.id, matchedName: g.name, confidence: 1 };
    }
  }
  let best: { id: string; name: string; score: number } | null = null;
  for (const g of goals) {
    const n = norm(g.name);
    let s = 0;
    if (n === target) s = 1;
    else if (n.includes(target) || target.includes(n)) s = 0.9;
    else s = diceCoefficient(n, target);
    if (!best || s > best.score) best = { id: g.id, name: g.name, score: s };
  }
  if (best && best.score >= 0.7) {
    return { raw, matchedId: best.id, matchedName: best.name, confidence: best.score };
  }
  return { raw, matchedId: null, matchedName: null, confidence: best?.score ?? 0 };
}

// ---------- date parsing ----------
const MONTHS_IT: Record<string, number> = { gen:1, feb:2, mar:3, apr:4, mag:5, giu:6, lug:7, ago:8, set:9, ott:10, nov:11, dic:12 };
const MONTHS_EN: Record<string, number> = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };

function tryParseDate(line: string): Date | null {
  const cleaned = line.trim();
  const iso = cleaned.match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (iso) {
    const [, y, m, d, hh, mm] = iso;
    const dt = new Date(Number(y), Number(m) - 1, Number(d), Number(hh ?? 0), Number(mm ?? 0));
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  const dmy = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (dmy) {
    const [, d, m, y, hh, mm] = dmy;
    let year = Number(y); if (year < 100) year += 2000;
    const dt = new Date(year, Number(m) - 1, Number(d), Number(hh ?? 0), Number(mm ?? 0));
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  const named = cleaned.match(/(\d{1,2})\s+([A-Za-zàèéìòù]{3,})\.?\s+(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (named) {
    const [, d, monRaw, y, hh, mm] = named;
    const key = monRaw.toLowerCase().slice(0, 3);
    const m = MONTHS_IT[key] ?? MONTHS_EN[key];
    if (m) {
      let year = Number(y); if (year < 100) year += 2000;
      return new Date(year, m - 1, Number(d), Number(hh ?? 0), Number(mm ?? 0));
    }
  }
  return null;
}

// ---------- natural-language normalization ----------
/**
 * Rewrite a single line in a "human" phrasing into the canonical compact
 * grammar above. Returns the original line if no pattern matches. Pure regex.
 */
function normalizeNaturalLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return line;

  // "Bought 2 BTC at 42000 from X" -> "BUY 2 BTC @ 42000 from X"
  let m = trimmed.match(/^bought\s+(.+)$/i);
  if (m) return `BUY ${m[1].replace(/\s+at\s+/i, " @ ")}`;
  m = trimmed.match(/^sold\s+(.+)$/i);
  if (m) return `SELL ${m[1].replace(/\s+at\s+/i, " @ ")}`;

  // "Invested 500 into VWCE [from X]" -> "BUY 500 VWCE [from X]"  (capital-only)
  m = trimmed.match(/^invested\s+(\d+(?:[.,]\d+)?)\s+(?:in|into)\s+([A-Za-z0-9._-]+)(.*)$/i);
  if (m) return `BUY ${m[1]} ${m[2]}${m[3] ?? ""}`;

  // "Transferred 100 from A to B" -> "100 A -> B"
  m = trimmed.match(/^transferr?ed\s+(\d+(?:[.,]\d+)?)\s+from\s+(.+?)\s+to\s+(.+)$/i);
  if (m) return `${m[1]} ${m[2]} -> ${m[3]}`;

  // "Added 300 to Emergency Fund" / "Contributed 300 to Goal X" -> "300 -> GOAL Emergency Fund"
  m = trimmed.match(/^(?:added|contributed|saved)\s+(\d+(?:[.,]\d+)?)\s+to\s+(?:goal\s+)?(.+)$/i);
  if (m) return `${m[1]} -> GOAL ${m[2]}`;

  return line;
}

// ---------- token patterns ----------
const RE_BUY_SELL =
  /^(BUY|SELL)\s+(?:(\d+(?:[.,]\d+)?)\s+([A-Za-z0-9._-]+)|([A-Za-z0-9._-]+)\s+qty\s+(\d+(?:[.,]\d+)?))(?:\s+(?:@|at|price)\s+(\d+(?:[.,]\d+)?))?(?:\s+(?:from|to)\s+(.+?))?(?:\s*,\s*(.+))?$/i;
const RE_GOAL_CREATE = /^GOAL\s+(.+?)\s+target\s+(\d+(?:[.,]\d+)?)\s*$/i;
const RE_GOAL_CONTRIB = /^(\d+(?:[.,]\d+)?)\s*(?:->|→|=>)\s*GOAL\s+(.+?)\s*$/i;
const RE_ACCOUNT_OPEN = /^ACCOUNT\s+(.+?)\s+balance\s+(\d+(?:[.,]\d+)?)\s*$/i;
const RE_ASSET_OPEN = /^ASSET\s+([A-Za-z0-9._-]+)\s+qty\s+(\d+(?:[.,]\d+)?)(?:\s+avg\s+(\d+(?:[.,]\d+)?))?\s*$/i;
const RE_TRANSFER = /^(\d+(?:[.,]\d+)?)\s+(.+?)\s*(?:->|→|=>)\s*(.+)$/;
const RE_AMOUNT = /^([+-]?)\s*(\d+(?:[.,]\d+)?)\s+(.+)$/;

function parseAmount(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", "."));
}
function splitCsv(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function blankEntry(line: string, lineNo: number, activeDate: Date): ParsedEntry {
  return {
    lineNo, raw: line, kind: "unknown",
    timestamp: activeDate.toISOString(), amount: 0,
    description: null, category: null,
    warnings: [], errors: [],
    unresolvedAccounts: [], unresolvedAssets: [], unresolvedGoals: [],
    severity: "error", confidence: 0, confidenceTier: "low",
  };
}

function parseEntryLine(
  rawLine: string, lineNo: number, activeDate: Date,
  input: ParseInput, ignoredAcct: Set<string>, ignoredAsset: Set<string>, ignoredGoal: Set<string>,
): ParsedEntry {
  const line = normalizeNaturalLine(rawLine);
  const base = blankEntry(rawLine, lineNo, activeDate);
  const { accounts, assets, goals, aliases, defaultAccountId } = input;

  // ---- ACCOUNT opening balance ----
  let m = line.match(RE_ACCOUNT_OPEN);
  if (m) {
    const acctRaw = m[1].trim();
    const balance = parseAmount(m[2]);
    const acct = resolveAccount(acctRaw, accounts, aliases);
    const e: ParsedEntry = { ...base, kind: "account_open", amount: balance, account: acct, description: `Opening balance: ${acctRaw}` };
    if (!acct.matchedId) {
      if (ignoredAcct.has(norm(acctRaw))) e.warnings.push(`Skipped: unknown account "${acctRaw}"`);
      else {
        // Preferred path: engine will inline-create the account and track it.
        e.willCreateAccount = true;
        e.warnings.push(`Will create new account "${acctRaw}"`);
      }
    }
    if (!Number.isFinite(balance)) e.errors.push("Invalid balance");
    return finalize(e);
  }

  // ---- ASSET opening position ----
  m = line.match(RE_ASSET_OPEN);
  if (m) {
    const symRaw = m[1];
    const qty = parseAmount(m[2]);
    const avg = m[3] ? parseAmount(m[3]) : undefined;
    const asset = resolveAsset(symRaw, assets, aliases);
    const total = avg ? qty * avg : 0;
    const e: ParsedEntry = {
      ...base, kind: "asset_open", amount: total, asset, quantity: qty, price: avg,
      description: `Opening position: ${qty} ${symRaw}${avg ? ` @ ${avg}` : ""}`,
    };
    if (!asset.matchedId) {
      if (ignoredAsset.has(norm(symRaw))) e.warnings.push(`Skipped: unknown asset "${symRaw}"`);
      else { e.errors.push(`Unknown asset "${symRaw}"`); e.unresolvedAssets.push(symRaw); }
    }
    if (!qty || qty <= 0) e.errors.push("Invalid quantity");
    if (avg === undefined) e.warnings.push("No average price — opening position will use last known market price");
    return finalize(e);
  }

  // ---- BUY / SELL ----
  m = line.match(RE_BUY_SELL);
  if (m) {
    const verb = m[1].toUpperCase() as "BUY" | "SELL";
    // either (qty, sym) or (sym qty form)
    const qtyTok = m[2] ?? m[5];
    const symTok = m[3] ?? m[4];
    const priceTok = m[6];
    const acctRaw = (m[7] ?? "").trim();
    const desc = m[8]?.trim() ?? null;

    const qtyRaw = parseAmount(qtyTok);
    const price = priceTok ? parseAmount(priceTok) : undefined;
    const asset = resolveAsset(symTok, assets, aliases);
    const acct = acctRaw ? resolveAccount(acctRaw, accounts, aliases) : undefined;

    // "BUY 1000 BTC from X" with no @ price = capital-only.
    // If asset price is known, derive quantity = capital/price.
    let quantity = qtyRaw;
    let effectivePrice = price;
    let total = 0;
    let capitalOnly = false;

    if (price !== undefined) {
      total = qtyRaw * price; // qty * price
    } else if (asset.matchedId) {
      const ass = (assets ?? []).find((a) => a.id === asset.matchedId);
      const mkt = Number(ass?.current_price ?? 0);
      if (mkt > 0) {
        // Treat qtyRaw as capital, derive quantity.
        capitalOnly = true;
        effectivePrice = mkt;
        quantity = qtyRaw / mkt;
        total = qtyRaw;
      } else {
        total = qtyRaw; // best-effort; will flag warning below
      }
    } else {
      total = qtyRaw;
    }

    const e: ParsedEntry = {
      ...base,
      kind: verb === "BUY" ? "buy" : "sell",
      amount: total,
      asset, quantity, price: effectivePrice,
      account: acct,
      description: desc,
    };

    if (!asset.matchedId) {
      if (ignoredAsset.has(norm(symTok))) e.warnings.push(`Skipped: unknown asset "${symTok}"`);
      else { e.errors.push(`Unknown asset "${symTok}"`); e.unresolvedAssets.push(symTok); }
    }
    if (acctRaw && !acct?.matchedId) {
      if (ignoredAcct.has(norm(acctRaw))) e.warnings.push(`Skipped: unknown account "${acctRaw}"`);
      else { e.errors.push(`Unknown account "${acctRaw}"`); e.unresolvedAccounts.push(acctRaw); }
    }
    if (!acctRaw) e.errors.push(verb === "BUY" ? "Missing source account (use 'from <account>')" : "Missing destination account (use 'to <account>')");
    if (price === undefined && !capitalOnly) e.warnings.push("Missing price — using capital amount as cost basis");
    if (capitalOnly) e.warnings.push(`Capital-only ${verb} — quantity derived from live price ${effectivePrice}`);
    if (!quantity || quantity <= 0) e.errors.push("Invalid quantity");
    return finalize(e);
  }

  // ---- GOAL create ----
  m = line.match(RE_GOAL_CREATE);
  if (m) {
    const name = m[1].trim();
    const target = parseAmount(m[2]);
    const goal = resolveGoal(name, goals, aliases);
    const e: ParsedEntry = {
      ...base, kind: "goal_create", amount: 0, targetAmount: target, goal,
      description: `Create goal: ${name} → target ${target}`,
    };
    if (!Number.isFinite(target) || target <= 0) e.errors.push("Invalid target amount");
    if (goal.matchedId) e.warnings.push(`Goal "${goal.matchedName}" already exists — target will be updated`);
    return finalize(e);
  }

  // ---- GOAL contribution ----
  m = line.match(RE_GOAL_CONTRIB);
  if (m) {
    const amount = parseAmount(m[1]);
    const name = m[2].trim();
    const goal = resolveGoal(name, goals, aliases);
    const e: ParsedEntry = {
      ...base, kind: "goal_contribution", amount, goal,
      description: `Contribution → ${name}`,
    };
    if (!goal.matchedId) {
      if (ignoredGoal.has(norm(name))) e.warnings.push(`Skipped: unknown goal "${name}"`);
      else { e.errors.push(`Unknown goal "${name}"`); e.unresolvedGoals.push(name); }
    }
    if (!amount || amount <= 0) e.errors.push("Invalid amount");
    return finalize(e);
  }

  // ---- TRANSFER ----
  m = line.match(RE_TRANSFER);
  if (m) {
    const amount = parseAmount(m[1]);
    const fromRaw = m[2].trim();
    const restParts = splitCsv(m[3]);
    const toRaw = restParts.shift() ?? "";
    const desc = restParts.shift() ?? null;
    const cat = restParts.shift() ?? null;
    const from = resolveAccount(fromRaw, accounts, aliases);
    const to = resolveAccount(toRaw, accounts, aliases);
    const e: ParsedEntry = { ...base, kind: "transfer", amount, fromAccount: from, toAccount: to, description: desc, category: cat };
    if (!from.matchedId) {
      if (ignoredAcct.has(norm(fromRaw))) e.warnings.push(`Skipped: unknown source "${fromRaw}"`);
      else { e.errors.push(`Unknown source account "${fromRaw}"`); e.unresolvedAccounts.push(fromRaw); }
    }
    if (!to.matchedId) {
      if (ignoredAcct.has(norm(toRaw))) e.warnings.push(`Skipped: unknown destination "${toRaw}"`);
      else { e.errors.push(`Unknown destination account "${toRaw}"`); e.unresolvedAccounts.push(toRaw); }
    }
    if (from.matchedId && to.matchedId && from.matchedId === to.matchedId)
      e.errors.push("Transfer source and destination are the same account");
    if (!amount || amount <= 0) e.errors.push("Invalid amount");
    if (from.confidence < 0.9 && from.matchedId) e.warnings.push(`Fuzzy match for "${fromRaw}" → ${from.matchedName}`);
    if (to.confidence < 0.9 && to.matchedId) e.warnings.push(`Fuzzy match for "${toRaw}" → ${to.matchedName}`);
    return finalize(e);
  }

  // ---- DEPOSIT / EXPENSE ----
  m = line.match(RE_AMOUNT);
  if (m) {
    const sign = m[1] || "+";
    const amount = parseAmount(m[2]);
    const remainder = m[3];
    const hasComma = remainder.includes(",");
    const parts = splitCsv(remainder);
    let accountRaw = parts.shift() ?? "";
    let description = parts.shift() ?? null;
    const category = parts.shift() ?? null;
    let acct = resolveAccount(accountRaw, accounts, aliases);
    let usedDefault = false;
    if (!acct.matchedId && !hasComma && defaultAccountId) {
      const def = accounts.find((a) => a.id === defaultAccountId);
      if (def) {
        description = remainder.trim();
        accountRaw = def.name;
        acct = { raw: def.name, matchedId: def.id, matchedName: def.name, confidence: 0.7,
                 candidates: [{ id: def.id, name: def.name, score: 0.7 }] };
        usedDefault = true;
      }
    }
    const kind: ParsedKind = sign === "-" ? "expense" : "deposit";
    const e: ParsedEntry = { ...base, kind, amount, account: acct, description, category, usedDefaultAccount: usedDefault };
    if (!acct.matchedId) {
      if (ignoredAcct.has(norm(accountRaw))) e.warnings.push(`Skipped: unknown account "${accountRaw}"`);
      else { e.errors.push(`Unknown account "${accountRaw}"`); e.unresolvedAccounts.push(accountRaw); }
    } else if (usedDefault) {
      e.warnings.push(`Used default account → ${acct.matchedName}`);
    }
    if (!amount || amount <= 0) e.errors.push("Invalid amount");
    if (acct.matchedId && !usedDefault && acct.confidence < 0.9)
      e.warnings.push(`Fuzzy match for "${accountRaw}" → ${acct.matchedName}`);
    return finalize(e);
  }

  base.errors.push("Could not parse line");
  return finalize(base);
}

function finalize(e: ParsedEntry): ParsedEntry {
  // confidence: minimum of matched refs minus penalty for warnings/duplicates
  const confs: number[] = [];
  if (e.account) confs.push(e.account.matchedId ? e.account.confidence : 0);
  if (e.fromAccount) confs.push(e.fromAccount.matchedId ? e.fromAccount.confidence : 0);
  if (e.toAccount) confs.push(e.toAccount.matchedId ? e.toAccount.confidence : 0);
  if (e.asset) confs.push(e.asset.matchedId ? e.asset.confidence : 0);
  if (e.goal) confs.push(e.goal.matchedId ? e.goal.confidence : 0);
  let conf = confs.length ? Math.min(...confs) : (e.kind === "goal_create" ? 1 : 0);
  if (e.duplicateOf) conf = Math.min(conf, 0.5);
  if (e.errors.length) conf = 0;
  e.confidence = +conf.toFixed(2);
  e.confidenceTier = conf >= 0.9 ? "high" : conf >= 0.6 ? "medium" : "low";
  if (e.errors.length) e.severity = "error";
  else if (e.warnings.length || e.duplicateOf) e.severity = "warning";
  else e.severity = "ready";
  return e;
}

// ---------- duplicate detection (delegated to import-duplicates) ----------
import { detectDuplicates, type DupInput } from "./import-duplicates";
import { categorizeBatch } from "./import-categorize";

// ---------- top-level ----------
export function parseImportText(input: ParseInput): { entries: ParsedEntry[]; summary: ParseSummary } {
  const lines = input.text.split(/\r?\n/);
  const entries: ParsedEntry[] = [];
  let active = input.defaultDate ?? new Date();
  active.setHours(0, 0, 0, 0);
  const ignoredAcct = new Set((input.ignoredAccounts ?? []).map(norm));
  const ignoredAsset = new Set((input.ignoredAssets ?? []).map(norm));
  const ignoredGoal = new Set((input.ignoredGoals ?? []).map(norm));

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith("#") || line.startsWith("//")) return;

    const maybeDate = tryParseDate(line);
    if (maybeDate && !/[+\-]?\d+[.,]?\d*\s+\S/.test(line.replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, "").replace(/\d{4}-\d{2}-\d{2}/g, "").replace(/\d{1,2}:\d{2}/g, ""))) {
      active = maybeDate; return;
    }

    const e = parseEntryLine(line, idx + 1, active, input, ignoredAcct, ignoredAsset, ignoredGoal);
    entries.push(e);
  });

  // ---- auto-categorize (never overwrites existing categories) ----
  categorizeBatch(entries);

  // ---- duplicate detection pass (in-batch + against existing ledger) ----
  const dupInputs: DupInput[] = entries.map((e) => ({
    lineNo: e.lineNo,
    kind: e.kind,
    timestamp: e.timestamp,
    amount: e.amount,
    accountId: e.account?.matchedId ?? null,
    fromAccountId: e.fromAccount?.matchedId ?? null,
    toAccountId: e.toAccount?.matchedId ?? null,
    description: e.description ?? null,
  }));
  const dupMap = detectDuplicates(dupInputs, input.existingTransactions ?? []);
  for (const e of entries) {
    const m = dupMap.get(e.lineNo);
    if (!m) continue;
    e.duplicateOf = m.existingId ?? null;
    e.duplicateScore = m.score;
    e.duplicateReasons = m.reasons;
    if (m.duplicateOfLine) e.duplicateOfLine = m.duplicateOfLine;
    e.warnings.push(
      m.existingId
        ? `Possible duplicate (${Math.round(m.score * 100)}%) of existing transaction — ${m.reasons.join(", ")}`
        : `Possible duplicate of row ${m.duplicateOfLine} (${Math.round(m.score * 100)}%)`,
    );
    finalize(e);
  }

  let inflow = 0, outflow = 0;
  const c = { deposits: 0, expenses: 0, transfers: 0, buys: 0, sells: 0, goalCreates: 0, goalContributions: 0, accountOpens: 0, assetOpens: 0 };
  let errorCount = 0, warningCount = 0, duplicateCount = 0;
  for (const e of entries) {
    if (e.severity === "error") errorCount++;
    warningCount += e.warnings.length;
    if (e.duplicateOf || e.duplicateOfLine) duplicateCount++;
    switch (e.kind) {
      case "deposit": c.deposits++; inflow += e.amount; break;
      case "expense": c.expenses++; outflow += e.amount; break;
      case "transfer": c.transfers++; break;
      case "buy": c.buys++; outflow += e.amount; break;
      case "sell": c.sells++; inflow += e.amount; break;
      case "goal_create": c.goalCreates++; break;
      case "goal_contribution": c.goalContributions++; break;
      case "account_open": c.accountOpens++; break;
      case "asset_open": c.assetOpens++; break;
    }
  }
  return {
    entries,
    summary: { total: entries.length, ...c, inflow, outflow, net: inflow - outflow, errorCount, warningCount, duplicateCount },
  };
}

// ---------- issue grouping ----------
export type ImportIssueKind = "unknown_account" | "unknown_asset" | "unknown_goal";

export interface ImportIssue {
  kind: ImportIssueKind;
  raw: string;
  normalized: string;
  lineNos: number[];
  suggestions: { id: string; name: string; score: number }[];
}

export interface AccountIssue extends ImportIssue { kind: "unknown_account" }

export function groupImportIssues(
  entries: ParsedEntry[],
  accounts: AccountLike[],
  assets: AssetLike[] = [],
  goals: GoalLike[] = [],
): ImportIssue[] {
  const map = new Map<string, ImportIssue>();
  const push = (kind: ImportIssueKind, raw: string, lineNo: number, suggestionsFn: (key: string) => ImportIssue["suggestions"]) => {
    const key = `${kind}:${norm(raw)}`;
    if (!norm(raw)) return;
    let g = map.get(key);
    if (!g) { g = { kind, raw, normalized: norm(raw), lineNos: [], suggestions: suggestionsFn(norm(raw)) }; map.set(key, g); }
    if (!g.lineNos.includes(lineNo)) g.lineNos.push(lineNo);
  };
  for (const e of entries) {
    for (const r of e.unresolvedAccounts) push("unknown_account", r, e.lineNo,
      (k) => accounts.map((a) => ({ id: a.id, name: a.name, score: diceCoefficient(norm(a.name), k) }))
        .sort((x, y) => y.score - x.score).filter((s) => s.score >= 0.35).slice(0, 3));
    for (const r of e.unresolvedAssets) push("unknown_asset", r, e.lineNo,
      (k) => assets.map((a) => ({ id: a.id, name: a.symbol, score: Math.max(diceCoefficient(norm(a.symbol), k), diceCoefficient(norm(a.name ?? ""), k)) }))
        .sort((x, y) => y.score - x.score).filter((s) => s.score >= 0.35).slice(0, 3));
    for (const r of e.unresolvedGoals) push("unknown_goal", r, e.lineNo,
      (k) => goals.map((g) => ({ id: g.id, name: g.name, score: diceCoefficient(norm(g.name), k) }))
        .sort((x, y) => y.score - x.score).filter((s) => s.score >= 0.35).slice(0, 3));
  }
  return Array.from(map.values()).sort((a, b) => b.lineNos.length - a.lineNos.length);
}

/** Back-compat shim for callers expecting only account issues. */
export function groupAccountIssues(entries: ParsedEntry[], accounts: AccountLike[]): AccountIssue[] {
  return groupImportIssues(entries, accounts).filter((i): i is AccountIssue => i.kind === "unknown_account");
}

export { tryParseDate };

// ============================================================
// Inline editing helpers (Phase B — Inline Correction Center)
// ============================================================

export interface EntryEditOverride {
  accountId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  assetId?: string | null;
  goalId?: string | null;
  amount?: number;
  quantity?: number;
  price?: number;
  targetAmount?: number;
  timestamp?: string;
  description?: string | null;
  category?: string | null;
  tags?: string[];
}

function refForAccount(id: string | null, accounts: AccountLike[]): AccountRef | undefined {
  if (!id) return undefined;
  const a = accounts.find((x) => x.id === id);
  if (!a) return undefined;
  return { raw: a.name, matchedId: a.id, matchedName: a.name, confidence: 1, candidates: [{ id: a.id, name: a.name, score: 1 }] };
}
function refForAsset(id: string | null, assets: AssetLike[]): AssetRefExt | undefined {
  if (!id) return undefined;
  const a = assets.find((x) => x.id === id);
  if (!a) return undefined;
  return { raw: a.symbol, matchedId: a.id, matchedSymbol: a.symbol, confidence: 1 };
}
function refForGoal(id: string | null, goals: GoalLike[]): GoalRef | undefined {
  if (!id) return undefined;
  const g = goals.find((x) => x.id === id);
  if (!g) return undefined;
  return { raw: g.name, matchedId: g.id, matchedName: g.name, confidence: 1 };
}

/** Recompute confidence + severity from refs/errors/warnings (mirrors `finalize`). */
function finalizeEdited(e: ParsedEntry): ParsedEntry {
  const confs: number[] = [];
  if (e.account) confs.push(e.account.matchedId ? e.account.confidence : 0);
  if (e.fromAccount) confs.push(e.fromAccount.matchedId ? e.fromAccount.confidence : 0);
  if (e.toAccount) confs.push(e.toAccount.matchedId ? e.toAccount.confidence : 0);
  if (e.asset) confs.push(e.asset.matchedId ? e.asset.confidence : 0);
  if (e.goal) confs.push(e.goal.matchedId ? e.goal.confidence : 0);
  let conf = confs.length ? Math.min(...confs) : (e.kind === "goal_create" ? 1 : 0);
  if (e.duplicateOf) conf = Math.min(conf, 0.5);
  if (e.errors.length) conf = 0;
  e.confidence = +conf.toFixed(2);
  e.confidenceTier = conf >= 0.9 ? "high" : conf >= 0.6 ? "medium" : "low";
  if (e.errors.length) e.severity = "error";
  else if (e.warnings.length || e.duplicateOf) e.severity = "warning";
  else e.severity = "ready";
  return e;
}

/** Apply user override to a parsed entry → returns a new entry with fresh validation. */
export function applyEntryOverride(
  original: ParsedEntry,
  accounts: AccountLike[],
  assets: AssetLike[],
  goals: GoalLike[],
  o: EntryEditOverride,
): ParsedEntry {
  const e: ParsedEntry = {
    ...original,
    account: original.account ? { ...original.account } : undefined,
    fromAccount: original.fromAccount ? { ...original.fromAccount } : undefined,
    toAccount: original.toAccount ? { ...original.toAccount } : undefined,
    asset: original.asset ? { ...original.asset } : undefined,
    goal: original.goal ? { ...original.goal } : undefined,
    errors: [],
    warnings: [],
    unresolvedAccounts: [],
    unresolvedAssets: [],
    unresolvedGoals: [],
    duplicateOf: null,
    duplicateScore: undefined,
    duplicateReasons: undefined,
    duplicateOfLine: undefined,
  };

  if (o.accountId !== undefined) e.account = refForAccount(o.accountId, accounts);
  if (o.fromAccountId !== undefined) e.fromAccount = refForAccount(o.fromAccountId, accounts);
  if (o.toAccountId !== undefined) e.toAccount = refForAccount(o.toAccountId, accounts);
  if (o.assetId !== undefined) e.asset = refForAsset(o.assetId, assets);
  if (o.goalId !== undefined) e.goal = refForGoal(o.goalId, goals);
  if (o.amount !== undefined) e.amount = o.amount;
  if (o.quantity !== undefined) e.quantity = o.quantity;
  if (o.price !== undefined) e.price = o.price;
  if (o.targetAmount !== undefined) e.targetAmount = o.targetAmount;
  if (o.timestamp !== undefined) e.timestamp = o.timestamp;
  if (o.description !== undefined) e.description = o.description;
  if (o.category !== undefined) e.category = o.category;

  // Recompute amount for buy/sell/asset_open when qty*price form.
  if (e.kind === "buy" || e.kind === "sell" || e.kind === "asset_open") {
    const q = e.quantity ?? 0;
    const p = e.price ?? 0;
    if (q > 0 && p > 0) e.amount = q * p;
  }

  // Revalidate required references.
  if (["deposit", "expense", "account_open"].includes(e.kind) && !e.account?.matchedId)
    e.errors.push("Missing account");
  if (e.kind === "transfer") {
    if (!e.fromAccount?.matchedId) e.errors.push("Missing source account");
    if (!e.toAccount?.matchedId) e.errors.push("Missing destination account");
    if (e.fromAccount?.matchedId && e.fromAccount.matchedId === e.toAccount?.matchedId)
      e.errors.push("Source and destination are identical");
  }
  if (["buy", "sell"].includes(e.kind)) {
    if (!e.asset?.matchedId) e.errors.push("Missing asset");
    if (!e.account?.matchedId) e.errors.push("Missing account");
    if (!e.quantity || e.quantity <= 0) e.errors.push("Invalid quantity");
  }
  if (e.kind === "asset_open") {
    if (!e.asset?.matchedId) e.errors.push("Missing asset");
    if (!e.quantity || e.quantity <= 0) e.errors.push("Invalid quantity");
  }
  if (e.kind === "goal_create") {
    if (!e.targetAmount || e.targetAmount <= 0) e.errors.push("Invalid target");
  }
  if (e.kind === "goal_contribution") {
    if (!e.goal?.matchedId) e.errors.push("Missing goal");
    if (!e.amount || e.amount <= 0) e.errors.push("Invalid amount");
  }
  if (["deposit", "expense", "transfer", "account_open"].includes(e.kind)) {
    if (!e.amount || e.amount <= 0) e.errors.push("Invalid amount");
  }

  return finalizeEdited(e);
}

/** Re-run duplicate detection + summary after edits. Returns a fresh summary. */
export function recomputeBatchAfterEdits(
  entries: ParsedEntry[],
  existingTransactions: ParseInput["existingTransactions"] = [],
): ParseSummary {
  const dupInputs: DupInput[] = entries.map((e) => ({
    lineNo: e.lineNo, kind: e.kind, timestamp: e.timestamp, amount: e.amount,
    accountId: e.account?.matchedId ?? null,
    fromAccountId: e.fromAccount?.matchedId ?? null,
    toAccountId: e.toAccount?.matchedId ?? null,
    description: e.description ?? null,
  }));
  const dupMap = detectDuplicates(dupInputs, existingTransactions);
  for (const e of entries) {
    e.duplicateOf = null;
    e.duplicateScore = undefined;
    e.duplicateReasons = undefined;
    e.duplicateOfLine = undefined;
    const m = dupMap.get(e.lineNo);
    if (m) {
      e.duplicateOf = m.existingId ?? null;
      e.duplicateScore = m.score;
      e.duplicateReasons = m.reasons;
      if (m.duplicateOfLine) e.duplicateOfLine = m.duplicateOfLine;
      e.warnings = e.warnings.filter((w) => !w.startsWith("Possible duplicate"));
      e.warnings.push(
        m.existingId
          ? `Possible duplicate (${Math.round(m.score * 100)}%) of existing transaction — ${m.reasons.join(", ")}`
          : `Possible duplicate of row ${m.duplicateOfLine} (${Math.round(m.score * 100)}%)`,
      );
    }
    finalizeEdited(e);
  }

  let inflow = 0, outflow = 0;
  const c = { deposits: 0, expenses: 0, transfers: 0, buys: 0, sells: 0, goalCreates: 0, goalContributions: 0, accountOpens: 0, assetOpens: 0 };
  let errorCount = 0, warningCount = 0, duplicateCount = 0;
  for (const e of entries) {
    if (e.severity === "error") errorCount++;
    warningCount += e.warnings.length;
    if (e.duplicateOf || e.duplicateOfLine) duplicateCount++;
    switch (e.kind) {
      case "deposit": c.deposits++; inflow += e.amount; break;
      case "expense": c.expenses++; outflow += e.amount; break;
      case "transfer": c.transfers++; break;
      case "buy": c.buys++; outflow += e.amount; break;
      case "sell": c.sells++; inflow += e.amount; break;
      case "goal_create": c.goalCreates++; break;
      case "goal_contribution": c.goalContributions++; break;
      case "account_open": c.accountOpens++; break;
      case "asset_open": c.assetOpens++; break;
    }
  }
  return { total: entries.length, ...c, inflow, outflow, net: inflow - outflow, errorCount, warningCount, duplicateCount };
}

