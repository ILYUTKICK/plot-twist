import { NextRequest, NextResponse } from "next/server";
import { txlineFetch } from "@/lib/txline-client";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId } = await context.params;
  const asOf = request.nextUrl.searchParams.get("asOf");
  if (!/^\d+$/.test(fixtureId)) {
    return NextResponse.json({ error: "Invalid fixture ID" }, { status: 400 });
  }
  if (asOf && !/^\d{13}$/.test(asOf)) {
    return NextResponse.json({ error: "Invalid snapshot timestamp" }, { status: 400 });
  }

  try {
    const suffix = asOf ? `?asOf=${asOf}` : "";
    const upstream = await txlineFetch(`/scores/snapshot/${fixtureId}${suffix}`);
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "TxLINE score snapshot failed" },
      { status: 502 },
    );
  }
}
