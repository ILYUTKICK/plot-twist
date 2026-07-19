import { NextRequest, NextResponse } from "next/server";
import { txlineFetch } from "@/lib/txline-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startEpochDay = request.nextUrl.searchParams.get("startEpochDay");
  const competitionId = request.nextUrl.searchParams.get("competitionId");
  if (startEpochDay && !/^\d{5}$/.test(startEpochDay)) {
    return NextResponse.json({ error: "Invalid start epoch day" }, { status: 400 });
  }
  if (competitionId && !/^\d+$/.test(competitionId)) {
    return NextResponse.json({ error: "Invalid competition ID" }, { status: 400 });
  }

  const query = new URLSearchParams();
  if (startEpochDay) query.set("startEpochDay", startEpochDay);
  if (competitionId) query.set("competitionId", competitionId);
  const suffix = query.size ? `?${query.toString()}` : "";

  try {
    const upstream = await txlineFetch(`/fixtures/snapshot${suffix}`);
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "TxLINE fixtures request failed" },
      { status: 502 },
    );
  }
}
