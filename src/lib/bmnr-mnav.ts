type Confidence = "high" | "medium" | "low";

interface SourceMetadata {
  source: string;
  source_form?: string;
  accession_number?: string;
  filing_date?: string;
  as_of_date?: string;
  document_url?: string;
  confidence: Confidence;
  matched_text_snippet?: string;
  reason?: string;
}

interface ExtractedNumber {
  value: number;
  metadata: SourceMetadata;
  score: number;
}

interface TokenCandidate extends ExtractedNumber {
  asset: "ETH" | "BTC";
  docKey: string;
}

interface BmnrFilingDocument {
  form: string;
  accessionNumber: string;
  filingDate: string;
  documentUrl: string;
  documentName: string;
  text: string;
  priority: number;
}

interface BmnrHoldingsExtraction {
  eth_qty: number;
  btc_qty: number;
  metadata: SourceMetadata;
}

interface BmnrBalanceExtraction {
  latest_text_cash: number;
  latest_text_cash_metadata: SourceMetadata;
  xbrl_cash: number;
  xbrl_cash_metadata: SourceMetadata;
  debt: number;
  debt_metadata: SourceMetadata;
  preferred_notional: number;
  preferred_metadata: SourceMetadata;
}

interface BmnrSharesExtraction {
  shares_outstanding: number;
  metadata: SourceMetadata;
}

interface BmnrMarketData {
  bmnr_price: number;
  eth_price: number;
  btc_price: number;
  metadata: {
    bmnr_price: SourceMetadata;
    eth_price: SourceMetadata;
    btc_price: SourceMetadata;
  };
}

interface BmnrCalculationInput {
  bmnr_price: number;
  eth_price: number;
  btc_price: number;
  eth_qty: number;
  btc_qty: number;
  shares_outstanding: number;
  cash: number;
  debt: number;
  preferred_notional: number;
}

interface BmnrCalculationOutput {
  market_cap: number;
  crypto_nav: number;
  enterprise_value: number;
  mnav: number | null;
}

interface SecSubmissions {
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      form?: string[];
      primaryDocument?: string[];
    };
  };
}

interface SecDirectory {
  directory?: {
    item?: Array<{
      name?: string;
      type?: string;
    }>;
  };
}

interface SecCompanyFacts {
  facts?: Record<string, Record<string, {
    units?: Record<string, Array<{
      val?: number;
      end?: string;
      filed?: string;
      form?: string;
      frame?: string;
    }>>;
  }>>;
}

const BMNR_CIK = "0001829311";
const BMNR_CIK_NUMBER = "1829311";
const SEC_SUBMISSIONS_URL = `https://data.sec.gov/submissions/CIK${BMNR_CIK}.json`;
const SEC_COMPANY_FACTS_URL = `https://data.sec.gov/api/xbrl/companyfacts/CIK${BMNR_CIK}.json`;
const SEC_ARCHIVES_BASE = `https://www.sec.gov/Archives/edgar/data/${BMNR_CIK_NUMBER}`;
const SEC_FORMS_TO_SCAN = new Set(["8-K", "8-K/A", "10-Q", "10-K", "S-3", "S-3ASR", "424B5"]);
const SEC_TEXT_FORMS = new Set(["8-K", "8-K/A"]);
const SEC_PERIODIC_FORMS = new Set(["10-Q", "10-K"]);
const SEC_PROSPECTUS_FORMS = new Set(["S-3", "S-3ASR", "424B5"]);
const SEC_REQUEST_DELAY_MS = 175;
const SEC_TIMEOUT_MS = 10000;
const MARKET_TIMEOUT_MS = 8000;
const MAX_FILINGS_TO_SCAN = 12;
const TWELVE_DATA_API_URL = "https://api.twelvedata.com/quote";
const BINANCE_BOOK_TICKER_URL = "https://api.binance.com/api/v3/ticker/bookTicker";
const BITGET_SPOT_TICKERS_URL = "https://api.bitget.com/api/v2/spot/market/tickers";

const BMNR_MAX_BTC_HOLDINGS = numberFromEnv("BMNR_MAX_BTC_HOLDINGS", 10_000);

let lastSecRequestAt = 0;

function numberFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function failNumber(message: string): never {
  throw new Error(message);
}

function failMetadata(message: string): never {
  throw new Error(message);
}

function round(value: number, digits = 2): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function snippet(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 280);
}

function parseMagnitude(raw: string, unit?: string): number | null {
  const parsed = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return null;

  const normalizedUnit = unit?.toLowerCase();
  if (normalizedUnit === "billion") return parsed * 1_000_000_000;
  if (normalizedUnit === "million") return parsed * 1_000_000;
  if (normalizedUnit === "thousand") return parsed * 1_000;
  return parsed;
}

function parseMoney(raw: string, unit?: string): number | null {
  return parseMagnitude(raw, unit);
}

function parseDateText(value: string): string | undefined {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return trimmed;

  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (slash) {
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${year}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
  }

  const monthNames: Record<string, string> = {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12",
  };
  const longDate = trimmed.match(/^([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
  const month = longDate?.[1] ? monthNames[longDate[1].toLowerCase()] : undefined;
  if (longDate && month) {
    return `${longDate[3]}-${month}-${longDate[2].padStart(2, "0")}`;
  }

  return undefined;
}

function extractAsOfDate(text: string): string | undefined {
  const patterns = [
    /as of (?:\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?)?\s*(?:ET|EST|EDT)?\s*on\s*)?([A-Z][a-z]+ \d{1,2}, \d{4})/i,
    /as of (\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /as of (\d{4}-\d{2}-\d{2})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const parsed = match?.[1] ? parseDateText(match[1]) : undefined;
    if (parsed) return parsed;
  }

  return undefined;
}

function extractFilingDateOverride(text: string): string | undefined {
  const patterns = [
    /as filed with the (?:u\.s\.\s*)?securities and exchange commission on ([A-Z][a-z]+ \d{1,2}, \d{4})/i,
    /prospectus dated ([A-Z][a-z]+ \d{1,2}, \d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const parsed = match?.[1] ? parseDateText(match[1]) : undefined;
    if (parsed) return parsed;
  }

  return undefined;
}

function compareDate(a?: string, b?: string): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a.localeCompare(b);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function secFetch<T>(url: string, parse: "json" | "text"): Promise<T> {
  const userAgent = process.env.SEC_USER_AGENT?.trim();
  if (!userAgent || /contact@example\.com/i.test(userAgent)) {
    throw new Error("SEC_USER_AGENT must be configured with a real contact email");
  }

  const elapsed = Date.now() - lastSecRequestAt;
  if (elapsed < SEC_REQUEST_DELAY_MS) {
    await sleep(SEC_REQUEST_DELAY_MS - elapsed);
  }

  lastSecRequestAt = Date.now();
  const response = await fetchWithTimeout(
    url,
    {
      cache: "no-store",
      headers: {
        Accept: parse === "json" ? "application/json" : "text/html,text/plain,*/*",
        "User-Agent": userAgent,
      },
    },
    SEC_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`SEC request failed ${response.status}: ${url}`);
  }

  return (parse === "json" ? await response.json() : await response.text()) as T;
}

async function marketFetch<T>(url: string): Promise<T> {
  const response = await fetchWithTimeout(
    url,
    { cache: "no-store", headers: { Accept: "application/json" } },
    MARKET_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`Market data request failed ${response.status}: ${url}`);
  }

  return (await response.json()) as T;
}

async function fetchTwelveDataPrice(symbol: string): Promise<{ price: number; metadata: SourceMetadata }> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) throw new Error("TWELVEDATA_API_KEY is not configured");

  const url = new URL(TWELVE_DATA_API_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey);

  const payload = await marketFetch<{
    symbol?: string;
    close?: string | number | null;
    previous_close?: string | number | null;
    extended_price?: string | number | null;
    status?: string;
    message?: string;
  }>(url.toString());

  if (payload.status === "error") {
    throw new Error(payload.message ?? `Twelve Data failed for ${symbol}`);
  }

  const price = [payload.extended_price, payload.close, payload.previous_close]
    .map((value) => Number(value))
    .find((value) => Number.isFinite(value) && value > 0);

  if (price == null) throw new Error(`Twelve Data returned no price for ${symbol}`);

  return {
    price,
    metadata: {
      source: "twelvedata",
      document_url: `${TWELVE_DATA_API_URL}?symbol=${encodeURIComponent(symbol)}`,
      confidence: "high",
      matched_text_snippet: `${symbol} quote`,
      as_of_date: new Date().toISOString(),
    },
  };
}

async function fetchCryptoPrice(symbol: "BTCUSDT" | "ETHUSDT"): Promise<{ price: number; metadata: SourceMetadata }> {
  const binanceUrl = `${BINANCE_BOOK_TICKER_URL}?symbol=${encodeURIComponent(symbol)}`;

  try {
    const payload = await marketFetch<{ bidPrice?: string; askPrice?: string }>(binanceUrl);
    const bid = Number(payload.bidPrice);
    const ask = Number(payload.askPrice);
    const price = bid > 0 && ask > 0 ? (bid + ask) / 2 : bid || ask;

    if (Number.isFinite(price) && price > 0) {
      return {
        price,
        metadata: {
          source: "binance",
          document_url: binanceUrl,
          confidence: "high",
          matched_text_snippet: symbol,
          as_of_date: new Date().toISOString(),
        },
      };
    }
  } catch {
    // Fall through to Bitget.
  }

  const bitgetUrl = `${BITGET_SPOT_TICKERS_URL}?symbol=${encodeURIComponent(symbol)}`;
  const payload = await marketFetch<{
    code?: string;
    data?: Array<{ lastPr?: string; bidPr?: string; askPr?: string; symbol?: string }>;
  }>(bitgetUrl);
  const ticker = payload.data?.[0];
  const price = [ticker?.lastPr, ticker?.bidPr, ticker?.askPr]
    .map((value) => Number(value))
    .find((value) => Number.isFinite(value) && value > 0);

  if (price == null) throw new Error(`No crypto price for ${symbol}`);

  return {
    price,
    metadata: {
      source: "bitget",
      document_url: bitgetUrl,
      confidence: "medium",
      matched_text_snippet: symbol,
      as_of_date: new Date().toISOString(),
    },
  };
}

async function fetchBmnrMarketData(): Promise<BmnrMarketData> {
  const [stock, eth, btc] = await Promise.all([
    fetchTwelveDataPrice("BMNR"),
    fetchCryptoPrice("ETHUSDT"),
    fetchCryptoPrice("BTCUSDT"),
  ]);

  return {
    bmnr_price: stock.price,
    eth_price: eth.price,
    btc_price: btc.price,
    metadata: {
      bmnr_price: stock.metadata,
      eth_price: eth.metadata,
      btc_price: btc.metadata,
    },
  };
}

function filingPriority(form: string, documentName: string): number {
  const name = documentName.toLowerCase();
  if ((form === "8-K" || form === "8-K/A") && /ex(?:hibit)?[-_]?99|ex99|991|press/.test(name)) return 100;
  if (form === "8-K" || form === "8-K/A") return 90;
  if (SEC_PROSPECTUS_FORMS.has(form)) return 70;
  if (SEC_PERIODIC_FORMS.has(form)) return 50;
  return 10;
}

async function fetchBmnrFilingDocuments(): Promise<BmnrFilingDocument[]> {
  const submissions = await secFetch<SecSubmissions>(SEC_SUBMISSIONS_URL, "json");
  const recent = submissions.filings?.recent;
  const docs: BmnrFilingDocument[] = [];

  if (!recent?.accessionNumber?.length) return docs;

  const candidates = recent.accessionNumber
    .map((accessionNumber, index) => ({
      accessionNumber,
      filingDate: recent.filingDate?.[index] ?? "",
      form: recent.form?.[index] ?? "",
      primaryDocument: recent.primaryDocument?.[index] ?? "",
    }))
    .filter((filing) => SEC_FORMS_TO_SCAN.has(filing.form) && filing.primaryDocument)
    .slice(0, MAX_FILINGS_TO_SCAN);

  for (const filing of candidates) {
    const accessionNoDashes = filing.accessionNumber.replace(/-/g, "");
    const archiveBase = `${SEC_ARCHIVES_BASE}/${accessionNoDashes}`;
    const documentNames = new Set<string>([filing.primaryDocument]);

    try {
      const index = await secFetch<SecDirectory>(`${archiveBase}/index.json`, "json");
      for (const item of index.directory?.item ?? []) {
        const name = item.name ?? "";
        const lower = name.toLowerCase();
        if (/\.(htm|html|txt)$/i.test(name) && /(ex99|ex-99|exhibit99|991|press|8-k|10-q|10-k|s-3|424b5)/.test(lower)) {
          documentNames.add(name);
        }
      }
    } catch {
      // Primary document is enough if the directory index is unavailable.
    }

    for (const documentName of documentNames) {
      const documentUrl = `${archiveBase}/${documentName}`;

      try {
        const raw = await secFetch<string>(documentUrl, "text");
        const text = stripHtml(raw);
        docs.push({
          form: filing.form,
          accessionNumber: filing.accessionNumber,
          filingDate: extractFilingDateOverride(text) ?? filing.filingDate,
          documentUrl,
          documentName,
          text,
          priority: filingPriority(filing.form, documentName),
        });
      } catch {
        // Continue scanning other filing documents.
      }
    }
  }

  return docs;
}

function buildMetadata(doc: BmnrFilingDocument, confidence: Confidence, text: string, reason?: string): SourceMetadata {
  return {
    source: "sec",
    source_form: doc.form,
    accession_number: doc.accessionNumber,
    filing_date: extractFilingDateOverride(text) ?? doc.filingDate,
    as_of_date: extractAsOfDate(text) ?? doc.filingDate,
    document_url: doc.documentUrl,
    confidence,
    matched_text_snippet: snippet(text),
    reason,
  };
}

function scoreTokenCandidate(asset: "ETH" | "BTC", window: string, numberValue: number): number {
  const lower = window.toLowerCase();
  let score = 0;
  const tokenWords =
    asset === "ETH"
      ? [" eth", "ethereum", "tokens"]
      : [" btc", "bitcoin", "bitcoin tokens"];

  if (tokenWords.some((word) => lower.includes(word))) score += 25;
  if (/(holdings?|held|treasury|crypto holdings?)/i.test(lower)) score += 20;
  if (/(crypto holdings? are comprised|holdings? are comprised|comprised of|treasury holdings?)/i.test(lower)) score += 35;
  if (new RegExp(`${asset.toLowerCase()} holdings?`).test(lower)) score += 15;
  if (/as of/i.test(window)) score += 5;
  if (/\$|price|market cap|volume|revenue|asset value|nav|per share|share price/i.test(window)) score -= 25;
  if (/(acquired|purchased|buys?|bought|past week|pace of buys|weekly)/i.test(window)) score -= 45;

  if (asset === "ETH" && numberValue >= 100_000 && numberValue < 50_000_000) score += 8;
  if (asset === "BTC" && numberValue > 0 && numberValue < 1_000_000) score += 8;
  if (asset === "ETH" && numberValue < 1_000) score -= 20;

  return score;
}

function isPlausibleTokenHolding(asset: "ETH" | "BTC", value: number, unit?: string): boolean {
  const normalizedUnit = unit?.toLowerCase();

  if (asset === "ETH") {
    return value >= 100_000 && value <= 50_000_000;
  }

  if (normalizedUnit === "million" || normalizedUnit === "billion") {
    return false;
  }

  return value > 0 && value <= BMNR_MAX_BTC_HOLDINGS;
}

function tokenPatterns(asset: "ETH" | "BTC"): RegExp[] {
  if (asset === "ETH") {
    return [
      /(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(million|billion|thousand)?\s+(?:ETH|Ethereum|ether)(?:\s+tokens?)?/gi,
      /(?:ETH|Ethereum|ether)\s+holdings?[^.]{0,120}?(?:reach|reached|of|are|were|total(?:ed)?|stands?\s+at)\s+(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(million|billion|thousand)?/gi,
      /including\s+(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(million|billion|thousand)?\s+(?:ETH|Ethereum|ether)\s+tokens?/gi,
      /crypto\s+holdings?[^.]{0,160}?comprised\s+of\s+(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(million|billion|thousand)?\s+(?:ETH|Ethereum|ether)/gi,
    ];
  }

  return [
    /(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(million|billion|thousand)?\s+(?:BTC|Bitcoin)(?:\s+tokens?)?/gi,
    /(?:BTC|Bitcoin)\s+holdings?[^.]{0,120}?(?:reach|reached|of|are|were|total(?:ed)?|stands?\s+at)\s+(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(million|billion|thousand)?/gi,
  ];
}

function collectTokenCandidates(asset: "ETH" | "BTC", docs: BmnrFilingDocument[]): TokenCandidate[] {
  const candidates: TokenCandidate[] = [];
  const patterns = tokenPatterns(asset);

  for (const doc of docs) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;

      for (const match of doc.text.matchAll(pattern)) {
        const value = parseMagnitude(match[1], match[2]);
        if (value == null || value <= 0) continue;
        if (!isPlausibleTokenHolding(asset, value, match[2])) continue;

        const start = Math.max(0, match.index - 180);
        const end = Math.min(doc.text.length, match.index + match[0].length + 180);
        const window = doc.text.slice(start, end);
        const score = scoreTokenCandidate(asset, window, value) + doc.priority + 50;
        const isApproximate = Boolean(match[2]);

        candidates.push({
          asset,
          value: Math.round(value),
          docKey: `${doc.accessionNumber}:${doc.documentUrl}`,
          metadata: buildMetadata(
            doc,
            score > doc.priority + 80 ? "high" : "medium",
            window,
            `${asset} direct SEC holding match score ${score}${isApproximate ? " approximate" : " exact"}`
          ),
          score: score + (isApproximate ? 0 : 20),
        });
      }
    }
  }

  return candidates;
}

function extractHoldings(docs: BmnrFilingDocument[]): BmnrHoldingsExtraction {
  const ethCandidates = collectTokenCandidates("ETH", docs);
  const btcCandidates = collectTokenCandidates("BTC", docs);
  const pairs = ethCandidates.flatMap((eth) =>
    btcCandidates
      .filter(
        (btc) =>
          btc.docKey === eth.docKey &&
          btc.metadata.as_of_date != null &&
          eth.metadata.as_of_date === btc.metadata.as_of_date
      )
      .map((btc) => ({
        eth,
        btc,
        score: eth.score + btc.score,
        asOf: eth.metadata.as_of_date,
        filingDate: eth.metadata.filing_date,
      }))
  );

  pairs.sort((a, b) => {
    const asOfCompare = compareDate(a.asOf, b.asOf);
    if (asOfCompare !== 0) return -asOfCompare;
    const filingCompare = compareDate(a.filingDate, b.filingDate);
    if (filingCompare !== 0) return -filingCompare;
    return b.score - a.score;
  });

  const selected = pairs[0];
  if (!selected) {
    throw new Error("Unable to extract same-date BMNR ETH/BTC holdings pair from SEC filings");
  }

  return {
    eth_qty: selected.eth.value,
    btc_qty: selected.btc.value,
    metadata: {
      ...selected.eth.metadata,
      confidence:
        selected.eth.metadata.confidence === "high" && selected.btc.metadata.confidence === "high"
          ? "high"
          : "medium",
      matched_text_snippet: `ETH: ${selected.eth.metadata.matched_text_snippet ?? ""} | BTC: ${selected.btc.metadata.matched_text_snippet ?? ""}`.slice(0, 500),
      reason: "Selected latest same-filing, same-as-of SEC holding pair for ETH and BTC",
    },
  };
}

function extractCashFromText(docs: BmnrFilingDocument[]): ExtractedNumber {
  const candidates: ExtractedNumber[] = [];
  const cashPattern = /(?:total\s+cash|cash\s+and\s+cash\s+equivalents|cash\s+totaled|cash\s+of)\s+(?:approximately\s+)?\$?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(million|billion|thousand)?/gi;

  for (const doc of docs) {
    if (!SEC_TEXT_FORMS.has(doc.form) && !SEC_PERIODIC_FORMS.has(doc.form)) continue;

    for (const match of doc.text.matchAll(cashPattern)) {
      const value = parseMoney(match[1], match[2]);
      if (value == null || value < 0) continue;

      const window = doc.text.slice(Math.max(0, match.index - 120), Math.min(doc.text.length, match.index + match[0].length + 120));
      candidates.push({
        value,
        score: doc.priority + 40,
        metadata: buildMetadata(doc, "high", window, "Latest text cash match"),
      });
    }
  }

  candidates.sort((a, b) => {
    const dateCompare = compareDate(a.metadata.as_of_date, b.metadata.as_of_date);
    if (dateCompare !== 0) return -dateCompare;
    return b.score - a.score;
  });

  const selected = candidates[0];
  if (!selected) {
    throw new Error("Unable to extract BMNR latest text cash from SEC filings");
  }

  return selected;
}

function extractShares(docs: BmnrFilingDocument[]): BmnrSharesExtraction {
  const candidates: ExtractedNumber[] = [];
  const sharePatterns = [
    /based\s+on\s+(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(million|billion|thousand)?\s+shares\s+of\s+(?:our\s+)?common\s+stock\s+outstanding\s+as\s+of/gi,
    /(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(million|billion|thousand)?\s+shares\s+of\s+(?:our\s+)?common\s+stock\s+outstanding\s+as\s+of/gi,
    /(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(million|billion|thousand)?\s+shares\s+of\s+(?:our\s+)?common\s+stock\s+outstanding/gi,
  ];

  for (const doc of docs) {
    if (!SEC_PROSPECTUS_FORMS.has(doc.form) && !SEC_TEXT_FORMS.has(doc.form) && !SEC_PERIODIC_FORMS.has(doc.form)) continue;

    for (const [patternIndex, pattern] of sharePatterns.entries()) {
      pattern.lastIndex = 0;

      for (const match of doc.text.matchAll(pattern)) {
        const value = parseMagnitude(match[1], match[2]);
        if (value == null || value <= 0) continue;

        const window = doc.text.slice(Math.max(0, match.index - 160), Math.min(doc.text.length, match.index + match[0].length + 200));
        if (
          /authorized|shares?\s+may\s+be\s+issued|to\s+be\s+sold|sold\s+by|selling\s+stockholders|securities\s+offered|shares?\s+offered|offered\s+hereby|treasury shares|reserved|issuable|warrant|option/i.test(window)
        ) {
          continue;
        }

        let score = doc.priority + 20;
        if (/based\s+on/i.test(window)) score += 45;
        if (/outstanding\s+as\s+of/i.test(window)) score += 35;
        if (SEC_PROSPECTUS_FORMS.has(doc.form)) score += 10;
        score += Math.max(0, 12 - patternIndex * 4);

        candidates.push({
          value: Math.round(value),
          score,
          metadata: buildMetadata(doc, score >= 120 ? "high" : "medium", window, "Common shares outstanding candidate"),
        });
      }
    }
  }

  candidates.sort((a, b) => {
    const dateCompare = compareDate(a.metadata.as_of_date, b.metadata.as_of_date);
    if (dateCompare !== 0) return -dateCompare;
    if (b.score !== a.score) return b.score - a.score;
    return b.value - a.value;
  });

  const selected = candidates[0];
  if (!selected) {
    throw new Error("Unable to extract BMNR common shares outstanding from SEC filings");
  }

  return {
    shares_outstanding: selected.value,
    metadata: selected.metadata,
  };
}

function factsForTag(companyFacts: SecCompanyFacts, tag: string): Array<{ val: number; end?: string; filed?: string; form?: string }> {
  const facts = companyFacts.facts?.["us-gaap"]?.[tag]?.units?.USD ?? [];
  return facts
    .filter((fact) => Number.isFinite(fact.val) && (fact.form ? SEC_PERIODIC_FORMS.has(fact.form) : true))
    .map((fact) => ({ val: Number(fact.val), end: fact.end, filed: fact.filed, form: fact.form }));
}

function latestFact(companyFacts: SecCompanyFacts, tags: string[]): { value: number; metadata: SourceMetadata } | null {
  const candidates = tags.flatMap((tag) =>
    factsForTag(companyFacts, tag).map((fact) => ({ tag, ...fact }))
  );

  candidates.sort((a, b) => {
    const filedCompare = compareDate(a.filed, b.filed);
    if (filedCompare !== 0) return -filedCompare;
    return -compareDate(a.end, b.end);
  });

  const selected = candidates[0];
  if (!selected) return null;

  return {
    value: selected.val,
    metadata: {
      source: "sec_companyfacts",
      source_form: selected.form,
      as_of_date: selected.end,
      filing_date: selected.filed,
      document_url: SEC_COMPANY_FACTS_URL,
      confidence: "medium",
      matched_text_snippet: selected.tag,
    },
  };
}

function extractXbrlDebt(companyFacts: SecCompanyFacts): { value: number; metadata: SourceMetadata } | null {
  const shortTerm = latestFact(companyFacts, ["ShortTermBorrowings"]);
  const current = latestFact(companyFacts, [
    "DebtCurrent",
    "LongTermDebtCurrent",
    "LongTermDebtAndFinanceLeaseObligationsCurrent",
  ]);
  const noncurrent = latestFact(companyFacts, [
    "LongTermDebtNoncurrent",
    "LongTermDebtAndFinanceLeaseObligationsNoncurrent",
  ]);
  const convertible = latestFact(companyFacts, ["ConvertibleNotesPayable"]);
  const pieces = [shortTerm, current, noncurrent, convertible].filter(
    (item): item is { value: number; metadata: SourceMetadata } => item != null
  );
  if (pieces.length === 0) return null;

  const latestDate = pieces
    .map((piece) => piece.metadata.filing_date)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);
  const filteredPieces = latestDate
    ? pieces.filter((piece) => piece.metadata.filing_date === latestDate)
    : pieces;
  const value = filteredPieces.reduce((sum, piece) => sum + piece.value, 0);

  return {
    value,
    metadata: {
      source: "sec_companyfacts",
      source_form: filteredPieces[0]?.metadata.source_form,
      filing_date: latestDate,
      as_of_date: filteredPieces[0]?.metadata.as_of_date,
      document_url: SEC_COMPANY_FACTS_URL,
      confidence: "medium",
      matched_text_snippet: filteredPieces
        .map((piece) => piece.metadata.matched_text_snippet)
        .filter(Boolean)
        .join(" + "),
      reason: "Summed latest short-term, current, noncurrent, and convertible XBRL debt tags",
    },
  };
}

function extractDebtFromText(docs: BmnrFilingDocument[]): ExtractedNumber | null {
  const candidates: ExtractedNumber[] = [];
  const debtPattern =
    /(?:short-term\s+borrowings|current\s+debt|long-term\s+debt|convertible\s+notes?\s+payable|outstanding\s+debt|debt\s+outstanding)\s+(?:of|total(?:ed)?|was|were|is|are|amount(?:ed)?\s+to)?\s*\$?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(million|billion|thousand)?/gi;

  for (const doc of docs) {
    if (!SEC_PERIODIC_FORMS.has(doc.form)) continue;
    const noDebtMatch = doc.text.match(/(?:had|has)\s+no\s+(?:outstanding\s+)?debt\s+as\s+of|no\s+outstanding\s+debt|no\s+debt/i);
    if (noDebtMatch?.index != null) {
      const window = doc.text.slice(Math.max(0, noDebtMatch.index - 120), Math.min(doc.text.length, noDebtMatch.index + noDebtMatch[0].length + 120));
      candidates.push({
        value: 0,
        score: doc.priority + 50,
        metadata: buildMetadata(doc, "high", window, "SEC text explicitly says no debt"),
      });
    }

    for (const match of doc.text.matchAll(debtPattern)) {
      const value = parseMoney(match[1], match[2]);
      if (value == null || value < 0) continue;

      const window = doc.text.slice(Math.max(0, match.index - 120), Math.min(doc.text.length, match.index + match[0].length + 120));
      if (/bad\s+debt|debt\s+expense|total\s+liabilities|warrant\s+liabilit|lease\s+liabilit|deferred\s+tax|asset\s+retirement/i.test(window)) continue;

      candidates.push({
        value,
        score: doc.priority + 30,
        metadata: buildMetadata(doc, "medium", window, "Debt amount candidate from SEC text"),
      });
    }
  }

  candidates.sort((a, b) => {
    const asOfCompare = compareDate(a.metadata.as_of_date, b.metadata.as_of_date);
    if (asOfCompare !== 0) return -asOfCompare;
    const filingCompare = compareDate(a.metadata.filing_date, b.metadata.filing_date);
    if (filingCompare !== 0) return -filingCompare;
    return b.score - a.score;
  });

  return candidates[0] ?? null;
}

function extractPreferredFromText(docs: BmnrFilingDocument[]): ExtractedNumber | null {
  const candidates: ExtractedNumber[] = [];
  const noPreferredPattern =
    /no\s+(?:shares\s+of\s+)?preferred\s+(?:shares|stock)\s+were\s+outstanding\s+as\s+of|no\s+preferred\s+(?:shares|stock)\s+(?:were\s+)?outstanding/i;
  const pattern = /(?:perpetual\s+preferred\s+stock|preferred\s+stock\s+notional\s+value|preferred\s+shares\s+outstanding|preferred\s+stock\s+liquidation\s+preference)[^.]{0,120}?\$?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(million|billion|thousand)?/gi;

  for (const doc of docs) {
    if (SEC_PERIODIC_FORMS.has(doc.form)) {
      const noPreferredMatch = doc.text.match(noPreferredPattern);
      if (noPreferredMatch?.index != null) {
        const window = doc.text.slice(
          Math.max(0, noPreferredMatch.index - 120),
          Math.min(doc.text.length, noPreferredMatch.index + noPreferredMatch[0].length + 120)
        );

        candidates.push({
          value: 0,
          score: doc.priority + 70,
          metadata: buildMetadata(doc, "high", window, "SEC text explicitly says no preferred shares outstanding"),
        });
      }
    }

    for (const match of doc.text.matchAll(pattern)) {
      const value = parseMoney(match[1], match[2]);
      if (value == null || value < 0) continue;
      const window = doc.text.slice(Math.max(0, match.index - 120), Math.min(doc.text.length, match.index + match[0].length + 120));
      if (/authorized|undesignated|may\s+issue|issuable|reserved/i.test(window)) continue;

      candidates.push({
        value,
        score: doc.priority + 50,
        metadata: buildMetadata(doc, "medium", window, "Preferred notional candidate"),
      });
    }
  }

  candidates.sort((a, b) => {
    const asOfCompare = compareDate(a.metadata.as_of_date, b.metadata.as_of_date);
    if (asOfCompare !== 0) return -asOfCompare;
    const filingCompare = compareDate(a.metadata.filing_date, b.metadata.filing_date);
    if (filingCompare !== 0) return -filingCompare;
    return b.score - a.score;
  });

  return candidates[0] ?? null;
}

async function extractBalances(docs: BmnrFilingDocument[]): Promise<BmnrBalanceExtraction> {
  const companyFacts = await secFetch<SecCompanyFacts>(SEC_COMPANY_FACTS_URL, "json");
  const textCash = extractCashFromText(docs);
  const xbrlCash = latestFact(companyFacts, [
    "CashAndCashEquivalentsAtCarryingValue",
    "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    "CashAndCashEquivalentsAndShortTermInvestments",
  ]);
  const textDebt = extractDebtFromText(docs);
  const xbrlDebt = extractXbrlDebt(companyFacts);
  const preferred = extractPreferredFromText(docs);

  return {
    latest_text_cash: textCash.value,
    latest_text_cash_metadata: textCash.metadata,
    xbrl_cash: xbrlCash?.value ?? failNumber("Unable to extract BMNR XBRL cash from SEC companyfacts"),
    xbrl_cash_metadata: xbrlCash?.metadata ?? failMetadata("Unable to extract BMNR XBRL cash metadata"),
    debt:
      textDebt?.value ??
      xbrlDebt?.value ??
      failNumber("Unable to extract BMNR debt from SEC filings or companyfacts"),
    debt_metadata:
      textDebt?.metadata ??
      xbrlDebt?.metadata ??
      failMetadata("Unable to extract BMNR debt metadata"),
    preferred_notional:
      preferred?.value ??
      failNumber("Unable to extract BMNR preferred notional from SEC filings"),
    preferred_metadata:
      preferred?.metadata ??
      failMetadata("Unable to extract BMNR preferred notional metadata"),
  };
}

function calculateBmnrMnav(input: BmnrCalculationInput): BmnrCalculationOutput {
  const market_cap = input.bmnr_price * input.shares_outstanding;
  const crypto_nav = input.eth_qty * input.eth_price + input.btc_qty * input.btc_price;
  const enterprise_value = market_cap + input.debt + input.preferred_notional - input.cash;

  return {
    market_cap,
    crypto_nav,
    enterprise_value,
    mnav: crypto_nav > 0 ? enterprise_value / crypto_nav : null,
  };
}

export async function fetchBmnrMnavFromSec() {
  const [marketData, docs] = await Promise.all([
    fetchBmnrMarketData(),
    fetchBmnrFilingDocuments(),
  ]);
  const [balances, holdings] = await Promise.all([
    extractBalances(docs),
    extractHoldings(docs),
  ]);
  const shares = extractShares(docs);
  const latestText = calculateBmnrMnav({
    bmnr_price: marketData.bmnr_price,
    eth_price: marketData.eth_price,
    btc_price: marketData.btc_price,
    eth_qty: holdings.eth_qty,
    btc_qty: holdings.btc_qty,
    shares_outstanding: shares.shares_outstanding,
    cash: balances.latest_text_cash,
    debt: balances.debt,
    preferred_notional: balances.preferred_notional,
  });
  const conservative = calculateBmnrMnav({
    bmnr_price: marketData.bmnr_price,
    eth_price: marketData.eth_price,
    btc_price: marketData.btc_price,
    eth_qty: holdings.eth_qty,
    btc_qty: holdings.btc_qty,
    shares_outstanding: shares.shares_outstanding,
    cash: balances.xbrl_cash,
    debt: balances.debt,
    preferred_notional: balances.preferred_notional,
  });
  const sourceAsOf =
    holdings.metadata.as_of_date ??
    shares.metadata.as_of_date ??
    balances.latest_text_cash_metadata.as_of_date ??
    null;

  return {
    ticker: "BMNR",
    name: "BitMine",
    stockPrice: round(marketData.bmnr_price, 2),
    currency: "USD",
    marketCapUsd: round(latestText.market_cap),
    tokenMarketValueUsd: round(latestText.crypto_nav),
    mnav: latestText.mnav != null ? round(latestText.mnav, 3) : null,
    holdings: [
      {
        asset: "ETH" as const,
        units: holdings.eth_qty,
        priceUsd: round(marketData.eth_price, 2),
        valueUsd: round(holdings.eth_qty * marketData.eth_price),
      },
      {
        asset: "BTC" as const,
        units: holdings.btc_qty,
        priceUsd: round(marketData.btc_price, 2),
        valueUsd: round(holdings.btc_qty * marketData.btc_price),
      },
    ].filter((holding) => holding.units > 0),
    sourceAsOf,
    sourceUrl: holdings.metadata.document_url ?? SEC_SUBMISSIONS_URL,
    dataAsOf: {
      prices: marketData.metadata.bmnr_price.as_of_date ?? null,
      holdings: holdings.metadata.as_of_date ?? null,
      cash: balances.latest_text_cash_metadata.as_of_date ?? null,
      xbrlCash: balances.xbrl_cash_metadata.as_of_date ?? null,
      shares: shares.metadata.as_of_date ?? null,
      debt: balances.debt_metadata.as_of_date ?? null,
      preferred: balances.preferred_metadata.as_of_date ?? null,
    },
    calculation: {
      latest_text_mnav: {
        ...latestText,
        mnav: latestText.mnav != null ? round(latestText.mnav, 6) : null,
      },
      xbrl_conservative_mnav: {
        ...conservative,
        mnav: conservative.mnav != null ? round(conservative.mnav, 6) : null,
      },
    },
    sec_metadata: {
      prices: marketData.metadata,
      holdings,
      cash: {
        latest_text_cash: balances.latest_text_cash,
        latest_text_cash_metadata: balances.latest_text_cash_metadata,
        xbrl_cash: balances.xbrl_cash,
        xbrl_cash_metadata: balances.xbrl_cash_metadata,
      },
      shares,
      debt: {
        debt: balances.debt,
        metadata: balances.debt_metadata,
      },
      preferred: {
        preferred_notional: balances.preferred_notional,
        metadata: balances.preferred_metadata,
      },
      scanned_documents: docs.map((doc) => ({
        source_form: doc.form,
        accession_number: doc.accessionNumber,
        filing_date: doc.filingDate,
        document_url: doc.documentUrl,
        priority: doc.priority,
      })),
    },
  };
}
