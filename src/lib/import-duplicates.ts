/**
 * Duplicate Detection Engine for Import Data.
 *
 * Pure / deterministic. Compares parsed import rows against:
 *  - other rows in the same batch
 *  - existing ledger transactions (already passed in by the parser caller)
 *
 * Emits a confidence 0..1 plus the matched existing transaction id (if any).
 * The parser owns wiring this back into ParsedEntry.duplicateOf — this module
 * never touches the DB and never mutates anything.
 */

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
   .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

export interface DupCandidateRow {
  // minimal shape; matches the existingTransactions arg the parser already builds
  id: string;
  execution_timestamp: string;
  fiat_value: number;
  source_account_id: string | null;
  destination_account_id: string | null;
  note: string | null;
}

export interface DupInput {
  lineNo: number;
  kind: string;             // ParsedEntry["kind"]
  timestamp: string;
  amount: number;
  accountId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  description?: string | null;
}

export interface DupMatch {
  /** confidence 0..1 — values >=0.6 are surfaced */
  score: number;
  /** matched existing tx id if the duplicate is in the ledger */
  existingId?: string;
  /** lineNo of an earlier in-batch row that this is a near-clone of */
  duplicateOfLine?: number;
  reasons: string[];
}

const DAY = 1000 * 60 * 60 * 24;

function tokenJaccard(a: string, b: string): number {
  const A = new Set(norm(a).split(" ").filter(Boolean));
  const B = new Set(norm(b).split(" ").filter(Boolean));
  if (!A.size && !B.size) return 1;
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach((t) => { if (B.has(t)) inter++; });
  return inter / (A.size + B.size - inter);
}

function dateProximity(aIso: string, bIso: string): number {
  const dt = Math.abs(new Date(aIso).getTime() - new Date(bIso).getTime());
  if (dt > 3 * DAY) return 0;
  if (dt < 60_000) return 1;          // within a minute
  return Math.max(0, 1 - dt / (3 * DAY));
}

function amountMatch(a: number, b: number): number {
  if (a === 0 && b === 0) return 1;
  const diff = Math.abs(a - b);
  if (diff < 0.005) return 1;
  const rel = diff / Math.max(Math.abs(a), Math.abs(b), 1);
  if (rel <= 0.001) return 1;
  if (rel <= 0.02) return 0.6;
  return 0;
}

function isLedgerKind(k: string) {
  return k === "deposit" || k === "expense" || k === "transfer" || k === "buy" || k === "sell";
}

function rowAccountId(r: DupInput): string | null | undefined {
  return r.accountId ?? r.fromAccountId ?? r.toAccountId ?? null;
}

function scoreAgainstExisting(row: DupInput, x: DupCandidateRow): DupMatch | null {
  const reasons: string[] = [];
  const dp = dateProximity(row.timestamp, x.execution_timestamp);
  if (dp <= 0) return null;
  const am = amountMatch(row.amount, Number(x.fiat_value));
  if (am <= 0) return null;

  const accId = rowAccountId(row);
  const accountHit =
    accId && (x.source_account_id === accId || x.destination_account_id === accId);
  const noteSim = row.description && x.note ? tokenJaccard(row.description, x.note) : 0;
  const bothNoteless = !row.description && !x.note ? 1 : 0;

  // weighted
  let score = 0;
  score += am * 0.35;
  score += dp * 0.25;
  score += (accountHit ? 1 : 0) * 0.25;
  score += Math.max(noteSim, bothNoteless * 0.6) * 0.15;

  if (am >= 1) reasons.push("same amount");
  if (dp >= 0.95) reasons.push("same minute");
  else if (dp >= 0.5) reasons.push("near-same date");
  if (accountHit) reasons.push("same account");
  if (noteSim >= 0.6) reasons.push("similar description");
  else if (bothNoteless) reasons.push("no description on either side");

  if (score < 0.6) return null;
  return { score: Math.min(1, score), existingId: x.id, reasons };
}

function scoreAgainstBatch(a: DupInput, b: DupInput): DupMatch | null {
  if (a.kind !== b.kind) return null;
  const dp = dateProximity(a.timestamp, b.timestamp);
  if (dp <= 0) return null;
  const am = amountMatch(a.amount, b.amount);
  if (am <= 0) return null;
  const sameAcct = rowAccountId(a) && rowAccountId(a) === rowAccountId(b);
  const noteSim = a.description && b.description ? tokenJaccard(a.description, b.description) : 0;
  const bothNoteless = !a.description && !b.description ? 1 : 0;

  let score = 0;
  score += am * 0.4;
  score += dp * 0.25;
  score += (sameAcct ? 1 : 0) * 0.2;
  score += Math.max(noteSim, bothNoteless * 0.6) * 0.15;

  if (score < 0.7) return null;
  const reasons: string[] = ["same kind"];
  if (am >= 1) reasons.push("same amount");
  if (dp >= 0.95) reasons.push("same minute");
  if (sameAcct) reasons.push("same account");
  if (noteSim >= 0.6 || bothNoteless) reasons.push("matching description");
  return { score: Math.min(1, score), duplicateOfLine: b.lineNo, reasons };
}

/**
 * Score every row in `rows`. Returns a Map keyed by lineNo. Rows that have no
 * plausible duplicate are absent from the map.
 */
export function detectDuplicates(
  rows: DupInput[],
  existing: DupCandidateRow[],
): Map<number, DupMatch> {
  const out = new Map<number, DupMatch>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!isLedgerKind(r.kind)) continue;

    let best: DupMatch | null = null;

    if (existing.length) {
      for (const x of existing) {
        const m = scoreAgainstExisting(r, x);
        if (m && (!best || m.score > best.score)) best = m;
      }
    }

    for (let j = 0; j < i; j++) {
      const m = scoreAgainstBatch(r, rows[j]);
      if (m && (!best || m.score > best.score)) best = m;
    }

    if (best) out.set(r.lineNo, best);
  }
  return out;
}
