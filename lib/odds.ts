export type TxlineOddsPayload = {
  FixtureId?: number;
  MessageId?: string;
  Ts?: number;
  SuperOddsType?: string;
  InRunning?: boolean;
  MarketPeriod?: string | null;
  PriceNames?: string[];
  Prices?: number[];
  Pct?: string[];
};

export type MatchWinnerMarket = {
  fixtureId: number;
  messageId: string;
  homePct: number;
  drawPct: number;
  awayPct: number;
  homePrice: number;
  drawPrice: number;
  awayPrice: number;
  inRunning: boolean;
  period: string;
  updatedAt: string;
};

function valueAt(payload: TxlineOddsPayload, key: string, values: Array<string | number> | undefined) {
  const index = payload.PriceNames?.indexOf(key) ?? -1;
  return index >= 0 ? values?.[index] : undefined;
}

export function normalizeMatchWinnerOdds(value: unknown): MatchWinnerMarket | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as TxlineOddsPayload;
  if (raw.SuperOddsType !== "1X2_PARTICIPANT_RESULT" || !raw.FixtureId) return null;

  const homePct = Number(valueAt(raw, "part1", raw.Pct));
  const drawPct = Number(valueAt(raw, "draw", raw.Pct));
  const awayPct = Number(valueAt(raw, "part2", raw.Pct));
  const homeRawPrice = Number(valueAt(raw, "part1", raw.Prices));
  const drawRawPrice = Number(valueAt(raw, "draw", raw.Prices));
  const awayRawPrice = Number(valueAt(raw, "part2", raw.Prices));

  if (![homePct, drawPct, awayPct, homeRawPrice, drawRawPrice, awayRawPrice].every(Number.isFinite)) {
    return null;
  }

  return {
    fixtureId: raw.FixtureId,
    messageId: raw.MessageId ?? `${raw.FixtureId}-${raw.Ts ?? Date.now()}`,
    homePct,
    drawPct,
    awayPct,
    homePrice: homeRawPrice / 1000,
    drawPrice: drawRawPrice / 1000,
    awayPrice: awayRawPrice / 1000,
    inRunning: Boolean(raw.InRunning),
    period: raw.MarketPeriod ?? "match",
    updatedAt: new Date(raw.Ts ?? Date.now()).toISOString(),
  };
}

export function findBestMatchWinnerMarket(value: unknown, fixtureId: number): MatchWinnerMarket | null {
  const payloads = Array.isArray(value) ? value : [value];
  const markets = payloads
    .map(normalizeMatchWinnerOdds)
    .filter((market): market is MatchWinnerMarket => market?.fixtureId === fixtureId);

  return markets.find((market) => market.period === "match")
    ?? markets.find((market) => market.period === "full_time")
    ?? markets[0]
    ?? null;
}
