/**
 * Rule-based auto-categorization for import rows.
 *
 * Pure regex-keyword matcher. No AI. Runs after parsing; only fills `category`
 * when the user (or the line itself) did not already provide one. User edits
 * in the preview always win — categorize never overwrites a non-empty value.
 */

import type { ParsedEntry } from "./import-parser";

interface Rule {
  category: string;
  patterns: RegExp[];
}

const INCOME_RULES: Rule[] = [
  { category: "Salary",     patterns: [/\bsalar(?:y|io)\b/i, /\bpayroll\b/i, /\bstipendio\b/i, /\bbusta paga\b/i] },
  { category: "Bonus",      patterns: [/\bbonus\b/i, /\bcommission(?:e|s)?\b/i] },
  { category: "Interest",   patterns: [/\binterest\b/i, /\binteress(?:e|i)\b/i, /\byield\b/i] },
  { category: "Dividend",   patterns: [/\bdividend\b/i] },
  { category: "Refund",     patterns: [/\brefund\b/i, /\brimborso\b/i, /\bcashback\b/i] },
  { category: "Gift",       patterns: [/\bgift\b/i, /\bregalo\b/i] },
];

const EXPENSE_RULES: Rule[] = [
  { category: "Groceries",     patterns: [/\bgrocer(?:y|ies)\b/i, /\bspesa\b/i, /\bsupermarket\b/i, /\besselunga\b/i, /\bcoop\b/i, /\blidl\b/i] },
  { category: "Rent",          patterns: [/\brent\b/i, /\baffitto\b/i, /\bmortgage\b/i, /\bmutuo\b/i] },
  { category: "Utilities",     patterns: [/\butilit(?:y|ies)\b/i, /\belectric(?:ity)?\b/i, /\bbolletta\b/i, /\benel\b/i, /\bgas\b/i, /\bwater\b/i, /\binternet\b/i, /\bwifi\b/i, /\bfastweb\b/i, /\btim\b/i] },
  { category: "Transport",     patterns: [/\bfuel\b/i, /\bgas station\b/i, /\bbenzina\b/i, /\bparking\b/i, /\btaxi\b/i, /\buber\b/i, /\btrain\b/i, /\btreno\b/i, /\bflight\b/i, /\bvolo\b/i] },
  { category: "Restaurants",   patterns: [/\brestaurant\b/i, /\bristorante\b/i, /\bdinner\b/i, /\blunch\b/i, /\bpranzo\b/i, /\bcena\b/i, /\bcaffe\b/i, /\bcoffee\b/i, /\bbar\b/i, /\bpizza\b/i] },
  { category: "Subscriptions", patterns: [/\bnetflix\b/i, /\bspotify\b/i, /\bsubscription\b/i, /\babbonament\b/i, /\bicloud\b/i, /\bapple\.com\/bill\b/i, /\baws\b/i] },
  { category: "Shopping",      patterns: [/\bamazon\b/i, /\bzalando\b/i, /\bshopping\b/i, /\bvestiti\b/i, /\bclothes\b/i] },
  { category: "Health",        patterns: [/\bdoctor\b/i, /\bpharma(?:cy)?\b/i, /\bfarmacia\b/i, /\bmedic\b/i, /\bhospital\b/i] },
  { category: "Fees",          patterns: [/\bfee\b/i, /\bcommissione\b/i, /\bbank fee\b/i] },
  { category: "Tax",           patterns: [/\btax(?:es)?\b/i, /\btasse\b/i, /\birpef\b/i, /\bvat\b/i, /\biva\b/i] },
];

const ASSET_CLASS_HINTS: Record<string, string> = {
  BTC: "Crypto", ETH: "Crypto", SOL: "Crypto", USDT: "Stablecoin", USDC: "Stablecoin",
  VWCE: "ETF", SWDA: "ETF", VUSA: "ETF", EUNL: "ETF", SPY: "ETF", QQQ: "ETF", VOO: "ETF",
  AAPL: "Stock", MSFT: "Stock", GOOGL: "Stock", AMZN: "Stock", TSLA: "Stock", NVDA: "Stock",
  GOLD: "Commodity", XAU: "Commodity",
};

function matchRules(text: string, rules: Rule[]): string | null {
  for (const r of rules) {
    for (const p of r.patterns) {
      if (p.test(text)) return r.category;
    }
  }
  return null;
}

/** Mutates `entry.category` only when empty. Safe to call multiple times. */
export function autoCategorize(entry: ParsedEntry): void {
  if (entry.category) return;
  const hay = [entry.description ?? "", entry.raw ?? ""].join(" ");

  switch (entry.kind) {
    case "deposit": {
      const c = matchRules(hay, INCOME_RULES);
      if (c) entry.category = c;
      break;
    }
    case "expense": {
      const c = matchRules(hay, EXPENSE_RULES);
      if (c) entry.category = c;
      break;
    }
    case "buy":
    case "sell":
    case "asset_open": {
      const sym = (entry.asset?.matchedSymbol ?? entry.asset?.raw ?? "").toUpperCase();
      const hint = ASSET_CLASS_HINTS[sym];
      if (hint) entry.category = hint;
      break;
    }
    case "transfer": {
      entry.category = "Transfer";
      break;
    }
    case "goal_contribution": {
      entry.category = "Goal";
      break;
    }
    default: break;
  }
}

export function categorizeBatch(entries: ParsedEntry[]): void {
  for (const e of entries) autoCategorize(e);
}
