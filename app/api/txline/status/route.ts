import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const configured = Boolean(process.env.TXLINE_API_TOKEN);

  return NextResponse.json({
    configured,
    mode: configured ? "live" : "replay",
    network: process.env.TXLINE_NETWORK ?? "devnet",
    apiOrigin: process.env.TXLINE_API_ORIGIN ?? "https://txline-dev.txodds.com",
  });
}
