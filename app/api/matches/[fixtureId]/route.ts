import { NextResponse } from "next/server";
import { normalizeMatchDetail, type RawTxlineFixture } from "@/lib/matches";
import { txlineFetch } from "@/lib/txline-client";

export const dynamic = "force-dynamic";

const TOURNAMENT_START_EPOCH_DAY = 20635;

async function jsonOrEmpty(response: Response) {
  if (!response.ok) return [];
  try {
    return await response.json() as unknown;
  } catch {
    return [];
  }
}
export async function GET(
  _request: Request,
  context: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId: rawFixtureId } = await context.params;
  if (!/^\d+$/.test(rawFixtureId)) {
    return NextResponse.json({ error: "Invalid fixture ID" }, { status: 400 });
  }
  const fixtureId = Number(rawFixtureId);

  try {
    const fixturesResponse = await txlineFetch(
      `/fixtures/snapshot?startEpochDay=${TOURNAMENT_START_EPOCH_DAY}`,
    );
    if (!fixturesResponse.ok) {
      return NextResponse.json({ error: "TxLINE fixture catalog failed" }, { status: 502 });
    }
    const fixtures: unknown = await fixturesResponse.json();
    const fixture = (Array.isArray(fixtures) ? fixtures : []).find(
      (item): item is RawTxlineFixture => Boolean(
        item && typeof item === "object" && (item as RawTxlineFixture).FixtureId === fixtureId,
      ),
    );
    if (!fixture || fixture.Competition !== "World Cup") {
      return NextResponse.json({ error: "Match not found in TxLINE World Cup catalog" }, { status: 404 });
    }

    const [scoresResponse, oddsResponse] = await Promise.all([
      txlineFetch(`/scores/snapshot/${fixtureId}`),
      txlineFetch(`/odds/snapshot/${fixtureId}`),
    ]);
    const [scores, odds] = await Promise.all([
      jsonOrEmpty(scoresResponse),
      jsonOrEmpty(oddsResponse),
    ]);
    const match = normalizeMatchDetail(fixture, scores, odds);
    if (!match) {
      return NextResponse.json({ error: "TxLINE returned an invalid match" }, { status: 502 });
    }

    return NextResponse.json(match, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Match details failed" },
      { status: 502 },
    );
  }
}
