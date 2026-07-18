import { NextRequest, NextResponse } from "next/server";
import { txlineFetch } from "@/lib/txline-client";
import type { TxlineOddsPayload } from "@/lib/odds";

export const dynamic = "force-dynamic";

type MarketPoint = {
  timestamp: number;
  probability: number;
};

const FIVE_MINUTES = 5 * 60 * 1000;

function partitionFor(timestamp: number) {
  const date = new Date(timestamp);
  return {
    epochDay: Math.floor(timestamp / 86_400_000),
    hour: date.getUTCHours(),
    interval: Math.floor(date.getUTCMinutes() / 5),
  };
}

async function loadPartition(timestamp: number): Promise<unknown[]> {
  const { epochDay, hour, interval } = partitionFor(timestamp);
  const response = await txlineFetch(`/odds/updates/${epochDay}/${hour}/${interval}`);
  if (!response.ok) throw new Error(`TxLINE odds history failed (${response.status})`);
  const payload: unknown = await response.json();
  return Array.isArray(payload) ? payload : [];
}

function toPoint(
  value: unknown,
  fixtureId: number,
  participant: "home" | "away",
): MarketPoint | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as TxlineOddsPayload;
  if (
    raw.FixtureId !== fixtureId
    || raw.SuperOddsType !== "1X2_PARTICIPANT_RESULT"
    || raw.MarketPeriod !== null
    || raw.InRunning !== true
    || !Number.isFinite(raw.Ts)
  ) return null;

  const priceName = participant === "home" ? "part1" : "part2";
  const index = raw.PriceNames?.indexOf(priceName) ?? -1;
  const probability = Number(index >= 0 ? raw.Pct?.[index] : undefined);
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 100) return null;

  return { timestamp: Number(raw.Ts), probability };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId: rawFixtureId } = await context.params;
  const rawEventTs = request.nextUrl.searchParams.get("eventTs") ?? "";
  const participant = request.nextUrl.searchParams.get("participant") ?? "away";
  if (!/^\d+$/.test(rawFixtureId) || !/^\d{13}$/.test(rawEventTs)) {
    return NextResponse.json({ error: "Invalid fixture or event timestamp" }, { status: 400 });
  }
  if (participant !== "home" && participant !== "away") {
    return NextResponse.json({ error: "Participant must be home or away" }, { status: 400 });
  }

  const fixtureId = Number(rawFixtureId);
  const eventTs = Number(rawEventTs);

  try {
    let payloads = await loadPartition(eventTs);
    let points = payloads
      .map((value) => toPoint(value, fixtureId, participant))
      .filter((value): value is MarketPoint => value !== null)
      .sort((a, b) => a.timestamp - b.timestamp);

    // A goal suspends the in-play market. That suspension gap is a cleaner
    // before/after boundary than the score event's delivery timestamp.
    let candidates = points.flatMap((before, index) => {
      const after = points[index + 1];
      if (!after) return [];
      const gapMs = after.timestamp - before.timestamp;
      const nearEvent = before.timestamp <= eventTs + 15_000
        && after.timestamp <= eventTs + 45_000
        && eventTs - before.timestamp <= 180_000;
      return gapMs >= 15_000 && nearEvent ? [{ before, after, gapMs }] : [];
    });

    if (!candidates.length) {
      const adjacent = await Promise.all([
        loadPartition(eventTs - FIVE_MINUTES),
        loadPartition(eventTs + FIVE_MINUTES),
      ]);
      payloads = [...adjacent[0], ...payloads, ...adjacent[1]];
      points = payloads
        .map((value) => toPoint(value, fixtureId, participant))
        .filter((value): value is MarketPoint => value !== null)
        .sort((a, b) => a.timestamp - b.timestamp);
      candidates = points.flatMap((before, index) => {
        const after = points[index + 1];
        if (!after) return [];
        const gapMs = after.timestamp - before.timestamp;
        const nearEvent = before.timestamp <= eventTs + 15_000
          && after.timestamp <= eventTs + 45_000
          && eventTs - before.timestamp <= 180_000;
        return gapMs >= 15_000 && nearEvent ? [{ before, after, gapMs }] : [];
      });
    }

    const shift = candidates.sort((a, b) => b.gapMs - a.gapMs)[0];
    if (!shift) {
      return NextResponse.json({ error: "No verified market suspension found" }, { status: 404 });
    }

    return NextResponse.json({
      fixtureId,
      eventTs,
      participant,
      before: {
        probability: shift.before.probability,
        timestamp: shift.before.timestamp,
      },
      after: {
        probability: shift.after.probability,
        timestamp: shift.after.timestamp,
      },
      delta: Number((shift.after.probability - shift.before.probability).toFixed(3)),
      suspensionMs: shift.gapMs,
      verified: true,
      source: "txline-historical",
    }, {
      headers: { "Cache-Control": "public, max-age=86400, immutable" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Market shift lookup failed" },
      { status: 502 },
    );
  }
}
