import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_FALLBACK, selectDemoReplayFrames, type ReplayFrame } from "../lib/replay.ts";

test("keeps Judge Mode on the two approved TxLINE events when generic live adds corners", () => {
  const corner: ReplayFrame = {
    delayMs: 0,
    id: "18218149-410-corner",
    fixtureId: 18218149,
    seq: 450,
    kind: "corner",
    minute: 43,
    team: "away",
    homeScore: 1,
    awayScore: 1,
    occurredAt: "2026-07-10T19:44:00.000Z",
    source: "replay",
  };
  const frames = selectDemoReplayFrames([DEMO_FALLBACK[1], corner, DEMO_FALLBACK[0]]);
  assert.deepEqual(frames.map((frame) => frame.id), [
    "18218149-404-yellow_card",
    "18218149-634-shot_on_target",
  ]);
  assert.deepEqual(frames.map((frame) => frame.delayMs), [1600, 17600]);
});
