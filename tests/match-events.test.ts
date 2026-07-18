import assert from "node:assert/strict";
import test from "node:test";
import {
  resolvePrediction,
  type MatchEvent,
  type PredictionTarget,
} from "../lib/match-events.ts";

const FIXTURE_ID = 18218149;

function event(overrides: Partial<MatchEvent> = {}): MatchEvent {
  return {
    id: "event-1",
    fixtureId: FIXTURE_ID,
    seq: 1,
    kind: "yellow_card",
    minute: 42,
    team: "home",
    homeScore: 1,
    awayScore: 1,
    occurredAt: "2026-07-10T19:43:17.949Z",
    source: "replay",
    ...overrides,
  };
}

const spainCard: PredictionTarget = {
  id: "card",
  fixtureId: FIXTURE_ID,
  team: "home",
};

test("wins only when event type, fixture, and team all match", () => {
  assert.equal(resolvePrediction(spainCard, event(), 50), "won");
});

test("does not award a Spain call for the same event by Belgium", () => {
  assert.equal(resolvePrediction(spainCard, event({ team: "away" }), 50), "pending");
});

test("ignores events from a different fixture", () => {
  assert.equal(resolvePrediction(spainCard, event({ fixtureId: 18257739, minute: 90 }), 50), "pending");
});

test("a matching event after the deadline loses", () => {
  assert.equal(resolvePrediction(spainCard, event({ minute: 51 }), 50), "lost");
});

test("a non-matching event at the deadline closes the call", () => {
  assert.equal(resolvePrediction(spainCard, event({ kind: "shot_on_target", minute: 50 }), 50), "lost");
});

test("another-goal calls are team agnostic but fixture scoped", () => {
  const goal: PredictionTarget = { id: "goal", fixtureId: FIXTURE_ID };
  assert.equal(resolvePrediction(goal, event({ kind: "goal", team: "away" }), 50), "won");
  assert.equal(resolvePrediction(goal, event({ kind: "goal", fixtureId: 18257739 }), 50), "pending");
});
