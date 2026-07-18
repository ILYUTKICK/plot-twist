import { NextRequest, NextResponse } from "next/server";
import { txlineFetch } from "@/lib/txline-client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const feed = request.nextUrl.searchParams.get("feed") ?? "scores";
  if (feed !== "scores" && feed !== "odds") {
    return NextResponse.json({ error: "feed must be scores or odds" }, { status: 400 });
  }

  try {
    const upstream = await txlineFetch(`/${feed}/stream`, {
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `TxLINE ${feed} stream failed`, status: upstream.status },
        { status: upstream.status || 502 },
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "TxLINE stream failed" },
      { status: 502 },
    );
  }
}
