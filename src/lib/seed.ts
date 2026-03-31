import type { Trade, Thought } from "@/types";

// ─── Helper ───────────────────────────────────────────────────────────────────

let _seq = 0;
function id(): string {
  return `seed_${(++_seq).toString().padStart(3, "0")}`;
}

function iso(date: string, time = "T10:00:00.000Z"): string {
  return `${date}${time}`;
}

// ─── Seed Trades (8 entries across 2025-2026) ─────────────────────────────────
//
// Closed trades sorted by exitDate to produce a realistic equity curve:
//   AAPL  exit Jun 20 2025   cumPnL  +$371
//   TSLA  exit Jul 01 2025   cumPnL  -$164  ← trough (max drawdown ~$535)
//   NVDA  exit Jul 20 2025   cumPnL  +$1264
//   BTC   exit Oct 15 2025   cumPnL  +$17396
//   QQQ   exit Dec 31 2025   cumPnL  +$18307
//   ETH   exit Jan 10 2026   cumPnL  +$17485

export const SEED_TRADES: Trade[] = [
  // ── 1. NVDA – US Stock – Long – Closed – Win ✓ ──────────────────────────
  {
    id: id(),
    ticker: "NVDA",
    name: "NVIDIA Corporation",
    direction: "long",
    status: "closed",
    assetClass: "stock",
    currency: "USD",
    entryDate: "2025-04-15",
    exitDate: "2025-07-20",
    entryPrice: 138.5,
    exitPrice: 174.3,
    quantity: 40,
    fees: 4.0,
    tags: ["AI", "semiconductors", "momentum"],
    setupType: "Breakout",
    notes:
      "Strong earnings beat, AI capex cycle intact. Entered on retest of breakout above prior highs.",
    createdAt: iso("2025-04-15"),
    updatedAt: iso("2025-07-20"),
  },

  // ── 2. AAPL – US Stock – Long – Closed – Small Win ✓ ───────────────────
  {
    id: id(),
    ticker: "AAPL",
    name: "Apple Inc.",
    direction: "long",
    status: "closed",
    assetClass: "stock",
    currency: "USD",
    entryDate: "2025-05-05",
    exitDate: "2025-06-20",
    entryPrice: 209.82,
    exitPrice: 228.5,
    quantity: 20,
    fees: 3.0,
    tags: ["mega-cap", "defensive"],
    setupType: "Pullback",
    notes:
      "Market selloff created oversold bounce. Strong support at 200-day MA. Quick swing trade.",
    createdAt: iso("2025-05-05"),
    updatedAt: iso("2025-06-20"),
  },

  // ── 3. TSLA – US Stock – Long – Closed – Loss ✗ ─────────────────────────
  {
    id: id(),
    ticker: "TSLA",
    name: "Tesla, Inc.",
    direction: "long",
    status: "closed",
    assetClass: "stock",
    currency: "USD",
    entryDate: "2025-06-10",
    exitDate: "2025-07-01",
    entryPrice: 254.0,
    exitPrice: 218.5,
    quantity: 15,
    fees: 2.5,
    tags: ["EV", "growth"],
    setupType: "Mean Reversion",
    notes:
      "Thesis failed – delivery shortfall hit harder than expected. Cut loss at -14%. Should have been tighter at -8%.",
    createdAt: iso("2025-06-10"),
    updatedAt: iso("2025-07-01"),
  },

  // ── 4. BTC – Crypto – Long – Closed – Win ✓ ─────────────────────────────
  {
    id: id(),
    ticker: "BTC-USD",
    name: "Bitcoin",
    direction: "long",
    status: "closed",
    assetClass: "crypto",
    currency: "USD",
    entryDate: "2025-08-10",
    exitDate: "2025-10-15",
    entryPrice: 56200,
    exitPrice: 88500,
    quantity: 0.5,
    fees: 18.0,
    tags: ["crypto", "halving", "macro"],
    setupType: "Trend Following",
    notes:
      "Post-halving cycle play. ETF inflow tailwind. Took partial profits at $80k, held rest to $88.5k.",
    createdAt: iso("2025-08-10"),
    updatedAt: iso("2025-10-15"),
  },

  // ── 5. 0700.HK – Tencent – HK Stock – Long – OPEN ───────────────────────
  {
    id: id(),
    ticker: "0700.HK",
    name: "Tencent Holdings",
    direction: "long",
    status: "open",
    assetClass: "stock",
    currency: "HKD",
    entryDate: "2025-10-08",
    exitDate: undefined,
    entryPrice: 388.0,
    exitPrice: undefined,
    quantity: 300,
    fees: 60.0,
    tags: ["China tech", "gaming", "AI"],
    setupType: "Value + Catalyst",
    notes:
      "AI monetisation (Yuanbao app) + buyback acceleration. Target HK$500. Stop below HK$340.",
    createdAt: iso("2025-10-08"),
    updatedAt: iso("2025-10-08"),
  },

  // ── 6. QQQ – ETF – Long – Closed – Win ✓ ────────────────────────────────
  {
    id: id(),
    ticker: "QQQ",
    name: "Invesco QQQ Trust",
    direction: "long",
    status: "closed",
    assetClass: "etf",
    currency: "USD",
    entryDate: "2025-10-05",
    exitDate: "2025-12-31",
    entryPrice: 490.2,
    exitPrice: 526.8,
    quantity: 25,
    fees: 3.5,
    tags: ["index", "tech", "macro"],
    setupType: "Trend Following",
    notes:
      "Rode the Q4 tech rally. Clean uptrend, no individual stock risk. Exited year-end for tax reasons.",
    createdAt: iso("2025-10-05"),
    updatedAt: iso("2025-12-31"),
  },

  // ── 7. ETH – Crypto – Long – Closed – Loss ✗ ────────────────────────────
  {
    id: id(),
    ticker: "ETH-USD",
    name: "Ethereum",
    direction: "long",
    status: "closed",
    assetClass: "crypto",
    currency: "USD",
    entryDate: "2025-12-02",
    exitDate: "2026-01-10",
    entryPrice: 3850,
    exitPrice: 3310,
    quantity: 1.5,
    fees: 12.0,
    tags: ["crypto", "DeFi"],
    setupType: "Breakout",
    notes:
      "False breakout above $4k resistance. BTC dominance kept rising. Lesson: wait for weekly close confirmation.",
    createdAt: iso("2025-12-02"),
    updatedAt: iso("2026-01-10"),
  },

  // ── 8. 9988.HK – Alibaba – HK Stock – Long – OPEN ───────────────────────
  {
    id: id(),
    ticker: "9988.HK",
    name: "Alibaba Group",
    direction: "long",
    status: "open",
    assetClass: "stock",
    currency: "HKD",
    entryDate: "2026-02-12",
    exitDate: undefined,
    entryPrice: 118.5,
    exitPrice: undefined,
    quantity: 500,
    fees: 80.0,
    tags: ["China tech", "e-commerce", "cloud"],
    setupType: "Value",
    notes:
      "DeepSeek catalyst rerates China AI ecosystem. Ant Group IPO rumours. Risk: geopolitical tension. Target HK$160.",
    createdAt: iso("2026-02-12"),
    updatedAt: iso("2026-02-12"),
  },
];

// ─── Seed Thoughts (4 entries) ────────────────────────────────────────────────

export const SEED_THOUGHTS: Thought[] = [
  {
    id: id(),
    title: "Fed Pivot Timeline – Still Too Early to Call",
    category: "macro",
    content: `The market is pricing ~2 cuts in H2 2025, but sticky services CPI and a resilient labour market make me think the Fed stays higher for longer than consensus expects.

Key watch: monthly PCE deflator. If core PCE stays above 2.5% through Q2, the June cut gets pushed to September or later.

**Positioning implication:** Prefer quality growth over speculative tech. Keep duration short. The "soft landing" narrative has pulled forward a lot of optimism.

Next catalyst: April 30 FOMC + press conference.`,
    tags: ["Fed", "rates", "macro", "inflation"],
    createdAt: iso("2025-06-20"),
    updatedAt: iso("2025-06-20"),
  },
  {
    id: id(),
    title: "NVIDIA – Is the AI Capex Cycle Durable?",
    category: "stock",
    ticker: "NVDA",
    content: `After reviewing Microsoft, Google, Meta and Amazon earnings calls, the message is unanimous: AI infra spend is accelerating, not decelerating.

NVDA's Blackwell ramp looks real – supply constraints are a revenue ceiling problem, not a demand problem. Data centre revenue guidance of $43B+ for FY26 seems conservative if hyperscaler capex keeps growing 30%+ YoY.

**Risk:** Custom silicon (TPUs, Trainium) could erode NVDA's share in 18–24 months. Monitor AWS/Google custom chip capacity.

**Thesis:** Hold current position. Would add on any 10–15% pullback to 50-day MA.`,
    tags: ["NVDA", "AI", "semiconductors", "capex"],
    createdAt: iso("2025-07-01"),
    updatedAt: iso("2025-07-05"),
  },
  {
    id: id(),
    title: "China Tech Re-rating: DeepSeek Changes the Narrative",
    category: "sector",
    content: `DeepSeek R1's performance at a fraction of the compute cost is a paradigm shift for the China tech sector. It proves:

1. Efficient training is possible without cutting-edge NVIDIA chips
2. China AI talent is world-class
3. The assumption that US export controls would permanently handicap Chinese AI was too simplistic

**Sector impact:** Tencent (AI assistant), Alibaba (cloud + Qwen models), Baidu (autonomous) all benefit from a valuation re-rating.

**My current exposure:** Long 0700.HK and 9988.HK. Combined position ~15% of portfolio.

**Key risk:** US tariff escalation, especially around Taiwan. Keep position sizing disciplined.`,
    tags: ["China", "AI", "tech", "Tencent", "Alibaba", "DeepSeek"],
    createdAt: iso("2025-10-10"),
    updatedAt: iso("2025-10-10"),
  },
  {
    id: id(),
    title: "Position Sizing Rules – My Framework",
    category: "strategy",
    content: `After reviewing Q3–Q4 2025 performance, my biggest mistake was position sizing inconsistency. Formalising the rules:

**Tier 1 – High Conviction (max 10% NAV)**
- 3+ independent reasons to buy
- Clear catalyst with defined timeline
- Liquid, easy to exit

**Tier 2 – Moderate Conviction (max 5% NAV)**
- Interesting thesis but 1–2 uncertainties
- Shorter holding period expected

**Tier 3 – Spec / Exploratory (max 2% NAV)**
- High risk/reward, willing to lose 100%

**Universal rules:**
- Never let any single position exceed 15% NAV (even after appreciation)
- Max total crypto exposure: 10% NAV
- Max total HK/China exposure: 20% NAV
- Cash floor: 15% at all times`,
    tags: ["risk management", "position sizing", "process"],
    createdAt: iso("2026-01-15"),
    updatedAt: iso("2026-01-15"),
  },
];
