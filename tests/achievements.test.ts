import assert from "node:assert/strict";
import test from "node:test";
import { buildAchievementMemo, parseAchievementMemo } from "../lib/achievements.ts";

const wallet = "69V6VgHSHAyqfias9pYe95kAozBhFPFy2a1waLZDhUi6";
const calls = [
  { predictionId: "card" as const, eventId: "18218149-404-yellow_card", minute: 42, xp: 210 },
  { predictionId: "shot" as const, eventId: "18218149-634-shot_on_target", minute: 60, xp: 140 },
];

test("builds a compact, internally consistent v2 wallet-signed achievement", () => {
  const memo = buildAchievementMemo({
    fixtureId: 18218149,
    wallet,
    calls,
    issuedAt: "2026-07-18T19:52:49.544Z",
  });
  const parsed = parseAchievementMemo(memo);
  assert.ok(Buffer.byteLength(memo, "utf8") <= 566);
  assert.equal(parsed?.version, 2);
  assert.equal(parsed?.verification, "wallet-signed-memo");
  assert.equal(parsed?.sessionXp, 350);
  assert.deepEqual(parsed?.calls.map((call) => call.event), calls.map((call) => call.eventId));
});

test("continues to verify the already-issued v1 achievement schema", () => {
  const memo = JSON.stringify({
    app: "PLOT_TWIST",
    version: 1,
    type: "fan-achievement",
    achievement: "PLOT_TWISTER",
    network: "solana-devnet",
    fixtureId: 18218149,
    wallet,
    verifiedCalls: calls.map((call) => ({
      prediction: call.predictionId,
      event: call.eventId,
      minute: call.minute,
      xp: call.xp,
    })),
    sessionXp: 350,
    issuedAt: "2026-07-18T19:52:49.544Z",
  });
  assert.equal(parseAchievementMemo(memo)?.version, 1);
});

test("rejects a memo with forged XP or events from another fixture", () => {
  const valid = JSON.parse(buildAchievementMemo({
    fixtureId: 18218149,
    wallet,
    calls,
    issuedAt: "2026-07-18T19:52:49.544Z",
  })) as Record<string, unknown>;
  assert.equal(parseAchievementMemo(JSON.stringify({ ...valid, sessionXp: 999 })), null);

  const resolvedCalls = valid.resolvedCalls as Array<Record<string, unknown>>;
  assert.equal(parseAchievementMemo(JSON.stringify({
    ...valid,
    resolvedCalls: [{ ...resolvedCalls[0], event: "18257739-404-yellow_card" }, resolvedCalls[1]],
  })), null);
});
