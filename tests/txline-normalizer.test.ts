import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTxlineScore } from "../lib/txline-normalizer.ts";

test("uses TxLINE Score.Total instead of opaque Stats keys", () => {
  const event = normalizeTxlineScore({
    FixtureId: 18257865,
    Seq: 654,
    Id: 600,
    Ts: 1784411000000,
    Action: "goal",
    Confirmed: true,
    Participant: 1,
    Participant1IsHome: true,
    Clock: { Seconds: 2852 },
    Score: {
      Participant1: { Total: { Goals: 1 } },
      Participant2: { Total: { Goals: 4 } },
    },
    Stats: { "1": 99, "2": 99 },
  }, "txline");

  assert.ok(event);
  assert.equal(event.kind, "goal");
  assert.equal(event.minute, 47);
  assert.equal(event.homeScore, 1);
  assert.equal(event.awayScore, 4);
});
test("normalizes confirmed corners as live story triggers", () => {
  const event = normalizeTxlineScore({
    FixtureId: 18257865,
    Seq: 700,
    Id: 650,
    Ts: 1784411100000,
    Action: "corner",
    Confirmed: true,
    Participant: 2,
    Participant1IsHome: true,
    Clock: { Seconds: 3000 },
    Score: {
      Participant1: { Total: { Goals: 1 } },
      Participant2: { Total: { Goals: 4 } },
    },
  }, "txline");

  assert.equal(event?.kind, "corner");
  assert.equal(event?.team, "away");
});
