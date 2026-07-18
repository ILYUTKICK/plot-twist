import { NextRequest, NextResponse } from "next/server";
import { parseAchievementMemo } from "@/lib/achievements";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

type ParsedInstruction = {
  parsed?: unknown;
  program?: string;
  programId?: string;
};

type RpcTransaction = {
  blockTime?: number | null;
  slot?: number;
  meta?: { err?: unknown } | null;
  transaction?: {
    signatures?: string[];
    message?: {
      accountKeys?: Array<{ pubkey?: string; signer?: boolean }>;
      instructions?: ParsedInstruction[];
    };
  };
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ signature: string }> },
) {
  const { signature } = await context.params;
  const expectedWallet = request.nextUrl.searchParams.get("wallet") ?? "";
  const expectedFixture = Number(request.nextUrl.searchParams.get("fixtureId"));
  if (!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(signature)) {
    return NextResponse.json({ verified: false, error: "Invalid signature" }, { status: 400 });
  }
  if (
    !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(expectedWallet)
    || !Number.isInteger(expectedFixture)
    || expectedFixture <= 0
  ) {
    return NextResponse.json({ verified: false, error: "Invalid achievement context" }, { status: 400 });
  }

  try {
    const rpcResponse = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [signature, {
          encoding: "jsonParsed",
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        }],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(7_000),
    });
    if (!rpcResponse.ok) throw new Error(`Solana RPC ${rpcResponse.status}`);
    const payload = await rpcResponse.json() as { result?: RpcTransaction | null };
    const transaction = payload.result;
    if (!transaction) {
      return NextResponse.json({ verified: false, status: "not-found" }, { status: 404 });
    }

    const memoInstruction = transaction.transaction?.message?.instructions?.find((instruction) => (
      instruction.programId === MEMO_PROGRAM_ID
      && instruction.program === "spl-memo"
      && typeof instruction.parsed === "string"
    ));
    const achievement = typeof memoInstruction?.parsed === "string"
      ? parseAchievementMemo(memoInstruction.parsed)
      : null;
    const signer = transaction.transaction?.message?.accountKeys?.find((account) => account.signer)?.pubkey;
    const verified = transaction.meta != null
      && transaction.meta.err === null
      && transaction.transaction?.signatures?.[0] === signature
      && signer === expectedWallet
      && achievement?.wallet === expectedWallet
      && achievement.fixtureId === expectedFixture;

    if (!verified || !achievement) {
      return NextResponse.json({ verified: false, status: "invalid" }, {
        status: 422,
        headers: { "Cache-Control": "no-store" },
      });
    }

    return NextResponse.json({
      verified: true,
      status: "confirmed",
      signature,
      slot: transaction.slot,
      blockTime: transaction.blockTime,
      wallet: achievement.wallet,
      fixtureId: achievement.fixtureId,
      achievement: achievement.achievement,
      verification: achievement.verification,
      version: achievement.version,
      calls: achievement.calls,
      sessionXp: achievement.sessionXp,
    }, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ verified: false, error: "Solana RPC unavailable" }, { status: 502 });
  }
}
