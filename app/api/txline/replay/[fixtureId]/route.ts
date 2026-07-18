import { NextResponse } from "next/server";
import { txlineFetch } from "@/lib/txline-client";
import { normalizeHistoricalSse } from "@/lib/txline-normalizer";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId } = await context.params;
  if (!/^\d+$/.test(fixtureId)) {
    return NextResponse.json({ error: "Invalid fixture ID" }, { status: 400 });
  }

  try {
    const upstream = await txlineFetch(`/scores/historical/${fixtureId}`);
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "TxLINE historical feed failed", status: upstream.status },
        { status: upstream.status },
      );
    }

    const events = normalizeHistoricalSse(await upstream.text());
    return NextResponse.json({
      fixtureId: Number(fixtureId),
      source: "TxLINE historical scores",
      eventCount: events.length,
      events: events.map(({ raw: _raw, ...event }, index) => ({
        ...event,
        delayMs: index * 900,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "TxLINE replay failed" },
      { status: 502 },
    );
  }
}
