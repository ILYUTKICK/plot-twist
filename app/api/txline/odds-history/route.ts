import { NextRequest, NextResponse } from "next/server";
import { txlineFetch } from "@/lib/txline-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const epochDay = request.nextUrl.searchParams.get("epochDay") ?? "";
  const hour = request.nextUrl.searchParams.get("hour") ?? "";
  const interval = request.nextUrl.searchParams.get("interval") ?? "";
  if (!/^\d{5}$/.test(epochDay) || !/^([0-9]|1[0-9]|2[0-3])$/.test(hour) || !/^\d+$/.test(interval)) {
    return NextResponse.json({ error: "Invalid historical odds partition" }, { status: 400 });
  }

  try {
    const upstream = await txlineFetch(`/odds/updates/${epochDay}/${hour}/${interval}`);
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "TxLINE odds history failed" },
      { status: 502 },
    );
  }
}
