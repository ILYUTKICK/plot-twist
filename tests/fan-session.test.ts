import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyFanSession,
  parseFanSession,
  sessionAccuracy,
  settleFanCall,
  type ActiveFanCall,
} from "../lib/fan-session.ts";
import type { MatchEvent } from "../lib/match-events.ts";

const FIXTURE_ID = 18257865;
const call: ActiveFanCall = {
  id: "shot",
  fixtureId: FIXTURE_ID,
  team: "home",
  roundEventId: `${FIXTURE_ID}-500-corner`,
  label: "France shot on target",
  xp: 140,
  deadlineMinute: 60,
};

function event(overrides: Partial<MatchEvent> = {}): MatchEvent {
  return {
    id: `${FIXTURE_ID}-510-shot_on_target`,
    fixtureId: FIXTURE_ID,
    seq: 510,
    kind: "shot_on_target",
    minute: 55,
    team: "home",
    homeScore: 1,
    awayScore: 4,
    occurredAt: "2026-07-18T21:55:00.000Z",
    source: "txline",
    ...overrides,
  };
}

test("settles a fixture-scoped live call and awards deterministic XP", () => {
  const settled = settleFanCall(emptyFanSession(FIXTURE_ID), call, event());
  assert.equal(settled.result, "won");
  assert.equal(settled.session.xp, 140);
  assert.equal(settled.session.streak, 1);
  assert.equal(settled.session.bestStreak, 1);
  assert.equal(settled.record?.settledByEventId, `${FIXTURE_ID}-510-shot_on_target`);
});

test("does not settle from another fixture or unrelated event", () => {
  const initial = emptyFanSession(FIXTURE_ID);
  assert.equal(settleFanCall(initial, call, event({ fixtureId: 999 })).result, "pending");
  assert.equal(settleFanCall(initial, call, event({ kind: "corner" })).result, "pending");
});

test("deadline loss resets the streak and cannot settle twice", () => {
  const won = settleFanCall(emptyFanSession(FIXTURE_ID), call, event()).session;
  const secondCall = { ...call, id: "card" as const, roundEventId: `${FIXTURE_ID}-520-goal`, xp: 210 };
  const lost = settleFanCall(won, secondCall, event({ id: `${FIXTURE_ID}-600-finished`, kind: "match_finished", minute: 90 }));
  assert.equal(lost.result, "lost");
  assert.equal(lost.session.xp, 140);
  assert.equal(lost.session.streak, 0);
  assert.equal(lost.session.bestStreak, 1);
  assert.equal(sessionAccuracy(lost.session), 50);

  const duplicate = settleFanCall(lost.session, secondCall, event({ id: `${FIXTURE_ID}-601-card`, kind: "yellow_card", minute: 59 }));
  assert.equal(duplicate.result, "pending");
  assert.equal(duplicate.session.records.length, 2);
});

test("restores only a session belonging to the selected fixture", () => {
  const stored = JSON.stringify({ ...emptyFanSession(FIXTURE_ID), xp: 140, streak: 1 });
  assert.equal(parseFanSession(stored, FIXTURE_ID).xp, 140);
  assert.deepEqual(parseFanSession(stored, 18218149), emptyFanSession(18218149));
  assert.deepEqual(parseFanSession("not-json", FIXTURE_ID), emptyFanSession(FIXTURE_ID));
});
