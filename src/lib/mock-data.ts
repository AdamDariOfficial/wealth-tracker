// Mock data for Wealth Tracker. Replace with Supabase queries in phase 2.

export const user = {
  name: "Alex Morgan",
  email: "alex@wealth.io",
  currency: "USD",
  monthlyIncome: 8500,
  weeklyContribution: 650,
  riskProfile: "Moderate-Aggressive",
};

export const stats = {
  netWorth: 142385.42,
  netWorthChange: 4.2,
  totalInvested: 98420,
  totalInvestedChange: 2.1,
  tradingCapital: 18500,
  tradingCapitalChange: 7.8,
  monthlyGrowth: 5810,
  monthlyGrowthChange: 12.4,
  weeklyContrib: 650,
  cashReserve: 25465,
  cashReserveChange: 1.2,
  pnl: 12384.5,
  pnlChange: 9.3,
};

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const netWorthSeries = months.map((m, i) => ({
  month: m,
  value: 80000 + i * 4800 + Math.round(Math.sin(i) * 3500),
  invested: 70000 + i * 3200,
}));

export const allocation = [
  { name: "ETFs",       value: 42, color: "var(--chart-1)" },
  { name: "Crypto",     value: 18, color: "var(--chart-3)" },
  { name: "Trading",    value: 13, color: "var(--chart-4)" },
  { name: "Stocks",     value: 12, color: "var(--chart-2)" },
  { name: "Cash",       value: 15, color: "var(--chart-5)" },
];

export const weeklyFlow = Array.from({ length: 12 }, (_, i) => ({
  week: `W${i + 1}`,
  amount: 500 + Math.round(Math.random() * 400),
}));

export const tradingPerformance = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  equity: 15000 + i * 110 + Math.round(Math.sin(i / 2) * 600),
}));

export const etfs = [
  { symbol: "VWCE", name: "Vanguard FTSE All-World", units: 142.5, avgPrice: 102.4, current: 118.3, allocation: 38, dca: 250, pnl: 2266.75, pnlPct: 15.5 },
  { symbol: "EIMI", name: "iShares Emerging Markets", units: 88.2, avgPrice: 32.1, current: 30.8, allocation: 18, dca: 100, pnl: -114.66, pnlPct: -4.0 },
  { symbol: "SXR8", name: "iShares Core S&P 500",   units: 24.7, avgPrice: 380.5, current: 472.1, allocation: 32, dca: 150, pnl: 2262.52, pnlPct: 24.1 },
  { symbol: "AGGH", name: "iShares Global Aggregate", units: 60.0, avgPrice: 4.8, current: 4.95, allocation: 12, dca: 50, pnl: 9.0, pnlPct: 3.1 },
];

export const crypto = [
  { symbol: "BTC", name: "Bitcoin",  units: 0.42, avgPrice: 38500, current: 67200, allocation: 56, pnl: 12054, pnlPct: 74.5 },
  { symbol: "ETH", name: "Ethereum", units: 4.8,  avgPrice: 2200,  current: 3450,  allocation: 28, pnl: 6000,  pnlPct: 56.8 },
  { symbol: "SOL", name: "Solana",   units: 32,   avgPrice: 95,    current: 168,   allocation: 11, pnl: 2336,  pnlPct: 76.8 },
  { symbol: "LINK",name: "Chainlink",units: 120,  avgPrice: 14.2,  current: 18.6,  allocation: 5,  pnl: 528,   pnlPct: 31.0 },
];

export const trades = [
  { id: 1, date: "2026-05-08", asset: "EURUSD", direction: "Long",  setup: "Breakout",  entry: 1.0820, sl: 1.0795, tp: 1.0890, pnl: 245,  rr: 2.8, rating: 5, session: "London" },
  { id: 2, date: "2026-05-07", asset: "BTCUSD", direction: "Short", setup: "Reversal",  entry: 67800, sl: 68500, tp: 66200, pnl: -180, rr: -1, rating: 3, session: "NY" },
  { id: 3, date: "2026-05-06", asset: "NAS100", direction: "Long",  setup: "Pullback",  entry: 18420, sl: 18380, tp: 18540, pnl: 320,  rr: 3.0, rating: 5, session: "NY" },
  { id: 4, date: "2026-05-05", asset: "XAUUSD", direction: "Long",  setup: "Trend cont.", entry: 2330, sl: 2322, tp: 2352, pnl: 158,  rr: 2.75, rating: 4, session: "London" },
  { id: 5, date: "2026-05-03", asset: "GBPJPY", direction: "Short", setup: "Liquidity grab", entry: 195.4, sl: 195.9, tp: 194.1, pnl: -95, rr: -1, rating: 2, session: "Asia" },
  { id: 6, date: "2026-05-02", asset: "SPX500", direction: "Long",  setup: "Breakout",  entry: 5180, sl: 5165, tp: 5215, pnl: 280,  rr: 2.3, rating: 4, session: "NY" },
];

export const equityCurve = trades
  .slice()
  .reverse()
  .reduce<{ idx: number; equity: number }[]>((acc, t, i) => {
    const prev = acc[i - 1]?.equity ?? 15000;
    acc.push({ idx: i + 1, equity: prev + t.pnl });
    return acc;
  }, []);

export const reserves = [
  { id: 1, category: "Emergency Fund",     amount: 12000, target: 15000, purpose: "6 months expenses" },
  { id: 2, category: "Opportunity Fund",   amount: 8500,  target: 10000, purpose: "Market dip buying" },
  { id: 3, category: "Business Capital",   amount: 3200,  target: 20000, purpose: "Side project launch" },
  { id: 4, category: "Tax Reserve",        amount: 1765,  target: 4000,  purpose: "Quarterly taxes" },
];

export const goals = [
  { id: 1, title: "First $10k Net Worth", current: 142385, target: 10000, deadline: "Achieved", done: true },
  { id: 2, title: "ETF Portfolio $50k",   current: 38420,  target: 50000, deadline: "2026-12-01" },
  { id: 3, title: "Trading Capital $25k", current: 18500,  target: 25000, deadline: "2026-09-30" },
  { id: 4, title: "Emergency Fund $15k",  current: 12000,  target: 15000, deadline: "2026-08-15" },
  { id: 5, title: "Net Worth $250k",      current: 142385, target: 250000, deadline: "2027-06-01" },
];

export const transactions = [
  { id: 1, date: "2026-05-09", asset: "VWCE", type: "Buy",      amount: 250,  account: "Trading 212" },
  { id: 2, date: "2026-05-09", asset: "BTC",  type: "Buy",      amount: 200,  account: "Kraken" },
  { id: 3, date: "2026-05-08", asset: "SXR8", type: "Buy",      amount: 150,  account: "Degiro" },
  { id: 4, date: "2026-05-07", asset: "USD",  type: "Deposit",  amount: 650,  account: "Cash" },
  { id: 5, date: "2026-05-05", asset: "ETH",  type: "Buy",      amount: 100,  account: "Kraken" },
  { id: 6, date: "2026-05-03", asset: "VWCE", type: "Dividend", amount: 18.4, account: "Trading 212" },
];

export const tradingMetrics = {
  winRate: 64,
  avgRR: 2.1,
  totalTrades: 87,
  bestSetup: "Breakout",
  worstSetup: "Liquidity grab",
  avgHold: "4h 12m",
  maxDrawdown: 8.4,
  profitFactor: 2.34,
};
