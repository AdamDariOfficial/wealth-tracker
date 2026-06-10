/**
 * Deterministic natural-language financial import parser.
 * NO AI / NO LLMs. Pure regex + tokenizer.
 *
 * Supports lines like:
 *   Lunedì 11/05/26 00:00          (date header)
 *   +240 contanti, pizzeria        (deposit)
 *   -105 Isy bank, Auto radio      (expense / withdrawal)
 *   30 contanti -> Isy bank, note  (transfer)
 *   -105 Isy bank, Auto radio, Car (with explicit category)
 */

export type ParsedKind = "deposit" | "expense" | "transfer" | "unknown";

export interface AccountRef {
  raw: string;
  matchedId: string | null;
  matchedName: string | null;
  confidence: number; // 0..1
  candidates: { id: string; name: string; score: number }[];
}

export interface ParsedEntry {
  lineNo: number;
  raw: string;
  kind: ParsedKind;
  timestamp: string; // ISO
  amount: number;
  account?: AccountRef;       // for deposit/expense
  fromAccount?: AccountRef;   // for transfer
  toAccount?: AccountRef;     // for transfer
  description: string | null;
  category: string | null;
  warnings: string[];
  errors: string[];
  duplicateOf?: string | null; // existing tx id
}

export interface ParseSummary {
  total: number;
  deposits: number;
  expenses: number;
  transfers: number;
  inflow: number;
  outflow: number;
  net: number;
  errorCount: number;
  warningCount: number;
}

export interface AccountLike {
  id: string;
  name: string;
  type?: string;
  provider?: string | null;
}

export interface ParseInput {
  text: string;
  accounts: AccountLike[];
  defaultDate?: Date;
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
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  let sizeA = 0;
  let sizeB = 0;
  A.forEach((v) => (sizeA += v));
  B.forEach((v) => (sizeB += v));
  A.forEach((v, k) => {
    const m = B.get(k);
    if (m) inter += Math.min(v, m);
  });
  return (2 * inter) / (sizeA + sizeB);
}

function resolveAccount(raw: string, accounts: AccountLike[]): AccountRef {
  const target = norm(raw);
  if (!target) {
    return { raw, matchedId: null, matchedName: null, confidence: 0, candidates: [] };
  }
  const scored = accounts.map((a) => {
    const n = norm(a.name);
    let score = 0;
    if (n === target) score = 1;
    else if (n.includes(target) || target.includes(n)) score = 0.85;
    else score = diceCoefficient(n, target);
    // synonyms
    if (target === "cash" || target === "contanti" || target === "contante") {
      if (n.includes("cash") || n.includes("contant")) score = Math.max(score, 0.95);
    }
    return { id: a.id, name: a.name, score };
  });
  scored.sort((x, y) => y.score - x.score);
  const top = scored[0];
  const confident = top && top.score >= 0.6;
  return {
    raw,
    matchedId: confident ? top.id : null,
    matchedName: confident ? top.name : null,
    confidence: top?.score ?? 0,
    candidates: scored.slice(0, 5),
  };
}

// ---------- date parsing ----------
const MONTHS_IT: Record<string, number> = {
  gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6,
  lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12,
};
const MONTHS_EN: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function tryParseDate(line: string): Date | null {
  const cleaned = line.trim();
  // ISO 2026-05-11 optional time
  const iso = cleaned.match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (iso) {
    const [, y, m, d, hh, mm] = iso;
    const dt = new Date(Number(y), Number(m) - 1, Number(d), Number(hh ?? 0), Number(mm ?? 0));
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  // dd/mm/yy(yy) or dd-mm-yy(yy)
  const dmy = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (dmy) {
    const [, d, m, y, hh, mm] = dmy;
    let year = Number(y);
    if (year < 100) year += 2000;
    const dt = new Date(year, Number(m) - 1, Number(d), Number(hh ?? 0), Number(mm ?? 0));
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  // "11 May 2026" / "11 mag 2026"
  const named = cleaned.match(/(\d{1,2})\s+([A-Za-zàèéìòù]{3,})\.?\s+(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (named) {
    const [, d, monRaw, y, hh, mm] = named;
    const key = monRaw.toLowerCase().slice(0, 3);
    const m = MONTHS_IT[key] ?? MONTHS_EN[key];
    if (m) {
      let year = Number(y);
      if (year < 100) year += 2000;
      return new Date(year, m - 1, Number(d), Number(hh ?? 0), Number(mm ?? 0));
    }
  }
  return null;
}

function isDateLine(line: string): boolean {
  return tryParseDate(line) !== null;
}

// ---------- entry parsing ----------
const AMOUNT_RE = /^([+-]?)\s*(\d+(?:[.,]\d+)?)\s+(.+)$/;
const TRANSFER_AMOUNT_RE = /^(\d+(?:[.,]\d+)?)\s+(.+?)\s*(?:->|→|=>)\s*(.+)$/;

function parseAmount(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", "."));
}

function splitCsv(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function parseEntryLine(
  line: string,
  lineNo: number,
  activeDate: Date,
  accounts: AccountLike[],
): ParsedEntry {
  const base: ParsedEntry = {
    lineNo,
    raw: line,
    kind: "unknown",
    timestamp: activeDate.toISOString(),
    amount: 0,
    description: null,
    category: null,
    warnings: [],
    errors: [],
  };

  // Transfer first: "30 contanti -> Isy bank, note"
  const t = line.match(TRANSFER_AMOUNT_RE);
  if (t) {
    const amount = parseAmount(t[1]);
    const fromRaw = t[2].trim();
    const restParts = splitCsv(t[3]);
    const toRaw = restParts.shift() ?? "";
    const desc = restParts.shift() ?? null;
    const cat = restParts.shift() ?? null;
    const from = resolveAccount(fromRaw, accounts);
    const to = resolveAccount(toRaw, accounts);
    const e: ParsedEntry = {
      ...base,
      kind: "transfer",
      amount,
      fromAccount: from,
      toAccount: to,
      description: desc,
      category: cat,
    };
    if (!from.matchedId) e.errors.push(`Unknown source account "${fromRaw}"`);
    if (!to.matchedId) e.errors.push(`Unknown destination account "${toRaw}"`);
    if (from.matchedId && to.matchedId && from.matchedId === to.matchedId)
      e.errors.push("Transfer source and destination are the same account");
    if (!amount || amount <= 0) e.errors.push("Invalid amount");
    if (from.confidence < 0.9 && from.matchedId) e.warnings.push(`Fuzzy match for "${fromRaw}" → ${from.matchedName}`);
    if (to.confidence < 0.9 && to.matchedId) e.warnings.push(`Fuzzy match for "${toRaw}" → ${to.matchedName}`);
    return e;
  }

  // Deposit / expense: "+240 contanti, desc, cat" or "-105 Isy bank, ..."
  const m = line.match(AMOUNT_RE);
  if (m) {
    const sign = m[1] || "+";
    const amount = parseAmount(m[2]);
    const parts = splitCsv(m[3]);
    const accountRaw = parts.shift() ?? "";
    const description = parts.shift() ?? null;
    const category = parts.shift() ?? null;
    const acct = resolveAccount(accountRaw, accounts);
    const kind: ParsedKind = sign === "-" ? "expense" : "deposit";
    const e: ParsedEntry = {
      ...base,
      kind,
      amount,
      account: acct,
      description,
      category,
    };
    if (!acct.matchedId) e.errors.push(`Unknown account "${accountRaw}"`);
    if (!amount || amount <= 0) e.errors.push("Invalid amount");
    if (acct.matchedId && acct.confidence < 0.9)
      e.warnings.push(`Fuzzy match for "${accountRaw}" → ${acct.matchedName}`);
    return e;
  }

  base.errors.push("Could not parse line");
  return base;
}

// ---------- duplicate detection ----------
function detectDuplicate(e: ParsedEntry, existing: ParseInput["existingTransactions"]): string | null {
  if (!existing?.length) return null;
  const ts = new Date(e.timestamp).getTime();
  const acctId =
    e.kind === "deposit" ? e.account?.matchedId :
    e.kind === "expense" ? e.account?.matchedId :
    e.kind === "transfer" ? e.fromAccount?.matchedId : null;
  if (!acctId) return null;
  for (const x of existing) {
    const xts = new Date(x.execution_timestamp).getTime();
    if (Math.abs(xts - ts) > 1000 * 60 * 60 * 24) continue; // within 24h
    if (Math.abs(Number(x.fiat_value) - e.amount) > 0.01) continue;
    if (x.source_account_id !== acctId && x.destination_account_id !== acctId) continue;
    if (e.description && x.note && norm(e.description) === norm(x.note)) return x.id;
    if (!e.description && !x.note) return x.id;
  }
  return null;
}

// ---------- top-level ----------
export function parseImportText(input: ParseInput): { entries: ParsedEntry[]; summary: ParseSummary } {
  const lines = input.text.split(/\r?\n/);
  const entries: ParsedEntry[] = [];
  let active = input.defaultDate ?? new Date();
  active.setHours(0, 0, 0, 0);

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith("#") || line.startsWith("//")) return;

    // Date header detection
    const maybeDate = tryParseDate(line);
    // Heuristic: a line that *only* contains date tokens (optionally a weekday)
    // is treated as a header. If it also contains amount markers, treat as entry.
    if (maybeDate && !/[+\-]?\d+[.,]?\d*\s+\S/.test(line.replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, "").replace(/\d{4}-\d{2}-\d{2}/g, "").replace(/\d{1,2}:\d{2}/g, ""))) {
      active = maybeDate;
      return;
    }

    const e = parseEntryLine(line, idx + 1, active, input.accounts);
    const dup = detectDuplicate(e, input.existingTransactions);
    if (dup) {
      e.duplicateOf = dup;
      e.warnings.push("Possible duplicate of existing transaction");
    }
    entries.push(e);
  });

  let inflow = 0;
  let outflow = 0;
  let deposits = 0;
  let expenses = 0;
  let transfers = 0;
  let errorCount = 0;
  let warningCount = 0;
  for (const e of entries) {
    if (e.errors.length) errorCount++;
    warningCount += e.warnings.length;
    if (e.kind === "deposit") {
      deposits++;
      inflow += e.amount;
    } else if (e.kind === "expense") {
      expenses++;
      outflow += e.amount;
    } else if (e.kind === "transfer") {
      transfers++;
    }
  }
  return {
    entries,
    summary: {
      total: entries.length,
      deposits,
      expenses,
      transfers,
      inflow,
      outflow,
      net: inflow - outflow,
      errorCount,
      warningCount,
    },
  };
}

export { isDateLine, tryParseDate };
