import { NextResponse } from "next/server";
import {
  normalizeFixture,
  normalizeMatchDetail,
  type MatchCatalogItem,
  type RawTxlineFixture,
} from "@/lib/matches";
import { txlineFetch } from "@/lib/txline-client";

export const dynamic = "force-dynamic";

// 1 July 2026: keeps the whole tournament in one real TxLINE fixture snapshot.
const TOURNAMENT_START_EPOCH_DAY = 20635;
const CATALOG_TTL_MS = 30_000;

let cachedCatalog: { expiresAt: number; matches: MatchCatalogItem[]; fetchedAt: string } | null = null;
let pendingCatalog: Promise<{ matches: MatchCatalogItem[]; fetchedAt: string }> | null = null;

async function buildCatalog() {
  const upstream = await txlineFetch(
    `/fixtures/snapshot?startEpochDay=${TOURNAMENT_START_EPOCH_DAY}`,
  );
  if (!upstream.ok) throw new Error(`TxLINE fixture catalog failed (${upstream.status})`);

  const payload: unknown = await upstream.json();
  const now = Date.now();
  const fixtures = (Array.isArray(payload) ? payload : []).filter(
    (fixture): fixture is RawTxlineFixture => Boolean(
      fixture && typeof fixture === "object" && (fixture as RawTxlineFixture).Competition === "World Cup",
    ),
  );
  const matches = fixtures
    .map((fixture) => normalizeFixture(fixture, now))
    .filter((match): match is MatchCatalogItem => match !== null);

  const liveCandidates = matches.filter((match) => match.phase === "live");
  const exactPhases = new Map<number, MatchCatalogItem["phase"]>();
  await Promise.all(liveCandidates.map(async (candidate) => {
    try {
      const response = await txlineFetch(`/scores/snapshot/${candidate.fixtureId}`);
      if (!response.ok) return;
      const scores: unknown = await response.json();
      const rawFixture = fixtures.find((fixture) => fixture.FixtureId === candidate.fixtureId);
      const detail = rawFixture ? normalizeMatchDetail(rawFixture, scores, [], now) : null;
      if (detail) exactPhases.set(candidate.fixtureId, detail.phase);
    } catch {
      // The kickoff-window phase remains a safe fallback when score coverage is unavailable.
    }
  }));

  const fetchedAt = new Date(now).toISOString();
  return {
    fetchedAt,
    matches: matches
      .map((match) => ({ ...match, phase: exactPhases.get(match.fixtureId) ?? match.phase }))
      .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime)),
  };
}

export async function GET() {
  try {
    const now = Date.now();
    if (cachedCatalog && cachedCatalog.expiresAt > now) {
      return NextResponse.json({
        source: "TxLINE fixtures + live score state",
        fetchedAt: cachedCatalog.fetchedAt,
        cached: true,
        matches: cachedCatalog.matches,
      }, { headers: { "Cache-Control": "private, max-age=15" } });
    }

    pendingCatalog ??= buildCatalog().finally(() => { pendingCatalog = null; });
    const catalog = await pendingCatalog;
    cachedCatalog = { ...catalog, expiresAt: Date.now() + CATALOG_TTL_MS };

    return NextResponse.json({
      source: "TxLINE fixtures + live score state",
      fetchedAt: catalog.fetchedAt,
      cached: false,
      matches: catalog.matches,
    }, { headers: { "Cache-Control": "private, max-age=15" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Match catalog failed" },
      { status: 502 },
    );
  }
}
