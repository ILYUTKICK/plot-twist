import { NextResponse } from "next/server";
import { txlineFetch } from "@/lib/txline-client";

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
    const upstream = await txlineFetch(`/odds/snapshot/${fixtureId}`);
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "TxLINE odds request failed" },
      { status: 502 },
    );
  }
}
