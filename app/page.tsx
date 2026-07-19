"use client";

// Interactive shell: match browsing, judge replay, narration, and fan proof.

import {
  ArrowRight,
  CheckCircle,
  Fire,
  Lightning,
  Play,
  ShieldCheck,
  SpeakerHigh,
  Trophy,
  UsersThree,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { JudgeMode, type JudgeAction } from "@/components/judge-mode";
import { MatchSelector } from "@/components/match-selector";
import { SelectedMatchExperience } from "@/components/selected-match-experience";
import { useRecapAudio } from "@/hooks/use-recap-audio";
import type { VerifiedCallProof } from "@/lib/achievements";
import {
  resolvePrediction,
  type MatchEvent,
  type MatchEventKind,
  type PredictionId,
  type PredictionResult,
  type TeamSide,
} from "@/lib/match-events";
import {
  DEMO_DEADLINE_MINUTE,
  DEMO_FALLBACK,
  DEMO_MATCH,
  DEMO_START_MINUTE,
  loadVerifiedDemoReplay,
  type ReplayFrame,
} from "@/lib/replay";
import {
  FALLBACK_STORY,
  fallbackFor,
  type DirectedStory,
  type StoryDirectorInput,
} from "@/lib/story";

const WalletAchievement = dynamic(
  () => import("@/components/wallet-achievement").then((module) => module.WalletAchievement),
  {
    ssr: false,
    loading: () => (
      <section className="proofStrip shell proofLoading">
        <span className="spinner" /> Loading Solana fan identity…
      </section>
    ),
  },
);

const leaders = [
  { name: "Maya", score: 2840, color: "#FFBE73" },
  { name: "You", score: 2310, color: "#F15433" },
  { name: "Leo", score: 1980, color: "#74A9FF" },
];

const DEMO_GOAL_TIMESTAMP = 1_783_712_528_198;

type StoryTrigger = StoryDirectorInput["trigger"];
type StoryEvent = Omit<MatchEvent, "kind"> & { kind: StoryTrigger };

type VerifiedMarketShift = {
  before: number;
  after: number;
  verified: true;
};

type StoryRound = {
  eventId: string;
  trigger: StoryTrigger;
  triggerTeam: string;
  minute: number;
  deadlineMinute: number;
};

type OpeningSnapshot = {
  story: DirectedStory;
  marketShift: VerifiedMarketShift | null;
  round: StoryRound;
};

const OPENING_EVENT: StoryEvent = {
  id: "18218149-389-goal",
  fixtureId: DEMO_MATCH.fixtureId,
  seq: 423,
  kind: "goal",
  minute: DEMO_START_MINUTE,
  team: "away",
  homeScore: 1,
  awayScore: 1,
  occurredAt: new Date(DEMO_GOAL_TIMESTAMP).toISOString(),
  source: "replay",
};

const OPENING_ROUND: StoryRound = {
  eventId: OPENING_EVENT.id,
  trigger: OPENING_EVENT.kind,
  triggerTeam: DEMO_MATCH.away.name,
  minute: DEMO_START_MINUTE,
  deadlineMinute: DEMO_DEADLINE_MINUTE,
};

function isStoryTrigger(kind: MatchEventKind): kind is StoryTrigger {
  return kind === "match_started"
    || kind === "live_state"
    || kind === "goal"
    || kind === "yellow_card"
    || kind === "red_card"
    || kind === "shot_on_target"
    || kind === "corner"
    || kind === "odds_shift";
}

function teamName(side?: TeamSide) {
  return side === "home" ? DEMO_MATCH.home.name : side === "away" ? DEMO_MATCH.away.name : "Match";
}

function eventName(kind: StoryTrigger) {
  return {
    match_started: "Live match",
    live_state: "Verified live clock",
    goal: "Goal",
    yellow_card: "Yellow card",
    red_card: "Red card",
    shot_on_target: "Shot on target",
    corner: "Corner",
    odds_shift: "Odds shift",
  }[kind];
}

async function verifiedShiftFor(event: StoryEvent, signal: AbortSignal) {
  if (event.kind !== "goal" || !event.team) return null;
  const eventTs = Date.parse(event.occurredAt);
  if (!Number.isFinite(eventTs)) return null;

  const response = await fetch(
    `/api/txline/market-shift/${event.fixtureId}?eventTs=${eventTs}&participant=${event.team}`,
    { signal },
  );
  if (!response.ok) return null;
  const payload = await response.json() as {
    before?: { probability?: number };
    after?: { probability?: number };
    verified?: boolean;
  };
  const before = Number(payload.before?.probability);
  const after = Number(payload.after?.probability);
  if (!payload.verified || !Number.isFinite(before) || !Number.isFinite(after)) return null;
  return {
    before: Number(before.toFixed(1)),
    after: Number(after.toFixed(1)),
    verified: true,
  } satisfies VerifiedMarketShift;
}

function formatProbability(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function Home() {
  const [activeFixtureId, setActiveFixtureId] = useState<number>(DEMO_MATCH.fixtureId);
  const [selected, setSelected] = useState<PredictionId | null>(null);
  const [result, setResult] = useState<PredictionResult>("pending");
  const [playing, setPlaying] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);
  const [minute, setMinute] = useState(DEMO_START_MINUTE);
  const [score, setScore] = useState({ home: 1, away: 1 });
  const [lastEvent, setLastEvent] = useState("Goal · Belgium");
  const [replayFrames, setReplayFrames] = useState<ReplayFrame[]>(DEMO_FALLBACK);
  const [verifiedReplay, setVerifiedReplay] = useState(false);
  const [story, setStory] = useState<DirectedStory>(FALLBACK_STORY);
  const [directorState, setDirectorState] = useState<"directing" | "ollama" | "fallback">("directing");
  const { voiceState, speak: playRecap, stop: stopRecap } = useRecapAudio();
  const [marketShift, setMarketShift] = useState<VerifiedMarketShift | null>(null);
  const [round, setRound] = useState<StoryRound>(OPENING_ROUND);
  const [xp, setXp] = useState(2310);
  const [streak, setStreak] = useState(4);
  const [verifiedCalls, setVerifiedCalls] = useState<VerifiedCallProof[]>([]);
  const [judgeOpen, setJudgeOpen] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [proofSignature, setProofSignature] = useState<string | null>(null);
  const selectedRef = useRef<PredictionId | null>(null);
  const resultRef = useRef<PredictionResult>("pending");
  const storyRef = useRef<DirectedStory>(FALLBACK_STORY);
  const roundRef = useRef<StoryRound>(OPENING_ROUND);
  const directorControllerRef = useRef<AbortController | null>(null);
  const openingSnapshotRef = useRef<OpeningSnapshot | null>(null);

  selectedRef.current = selected;
  resultRef.current = result;
  storyRef.current = story;
  roundRef.current = round;

  useEffect(() => {
    const rawFixtureId = new URL(window.location.href).searchParams.get("fixture");
    if (rawFixtureId && /^\d+$/.test(rawFixtureId)) {
      setActiveFixtureId(Number(rawFixtureId));
    }
  }, []);

  const requestRound = useCallback(async (event: StoryEvent, deadlineMinute: number) => {
    directorControllerRef.current?.abort();
    const controller = new AbortController();
    directorControllerRef.current = controller;
    const nextRound: StoryRound = {
      eventId: event.id,
      trigger: event.kind,
      triggerTeam: teamName(event.team),
      minute: event.minute,
      deadlineMinute,
    };
    setRound(nextRound);
    setDirectorState("directing");
    stopRecap();
    setMarketShift(null);

    const baseContext: StoryDirectorInput = {
      fixtureId: event.fixtureId,
      homeTeam: DEMO_MATCH.home.name,
      awayTeam: DEMO_MATCH.away.name,
      triggerTeam: teamName(event.team),
      trigger: event.kind,
      minute: event.minute,
      deadlineMinute,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
      marketBefore: 0,
      marketAfter: 0,
      marketVerified: false,
    };
    const immediateStory = fallbackFor(baseContext);
    setStory(immediateStory);
    storyRef.current = immediateStory;

    let verifiedShift: VerifiedMarketShift | null = null;
    try {
      verifiedShift = await verifiedShiftFor(event, controller.signal);
    } catch {
      if (controller.signal.aborted) return;
    }

    const context: StoryDirectorInput = {
      ...baseContext,
      marketBefore: verifiedShift?.before ?? 0,
      marketAfter: verifiedShift?.after ?? 0,
      marketVerified: Boolean(verifiedShift),
    };

    setMarketShift(verifiedShift);
    let directedStory: DirectedStory;
    try {
      const response = await fetch("/api/story-director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Story Director unavailable");
      directedStory = await response.json() as DirectedStory;
    } catch {
      if (controller.signal.aborted) return;
      directedStory = fallbackFor(context);
    }

    if (controller.signal.aborted) return;
    setStory(directedStory);
    setDirectorState(directedStory.source);
    if (event.id !== OPENING_EVENT.id || selectedRef.current === null) {
      setSelected(null);
      selectedRef.current = null;
      setResult("pending");
      resultRef.current = "pending";
    }

    if (event.id === OPENING_EVENT.id) {
      openingSnapshotRef.current = {
        story: directedStory,
        marketShift: verifiedShift,
        round: nextRound,
      };
    }
  }, [stopRecap]);

  useEffect(() => {
    void requestRound(OPENING_EVENT, DEMO_DEADLINE_MINUTE);

    return () => {
      directorControllerRef.current?.abort();
    };
  }, [requestRound]);

  useEffect(() => {
    if (!playing) return;
    const timers = replayFrames.map((event, index) => window.setTimeout(() => {
      setMinute(event.minute);
      setScore({ home: event.homeScore, away: event.awayScore });
      setLastEvent(`${event.kind.replaceAll("_", " ")} · ${teamName(event.team)}`);

      const prediction = selectedRef.current;
      if (prediction && resultRef.current === "pending") {
        const lockedCall = storyRef.current.calls.find((call) => call.id === prediction);
        const outcome = lockedCall
          ? resolvePrediction(lockedCall, event, roundRef.current.deadlineMinute)
          : "pending";
        if (outcome !== "pending") {
          setResult(outcome);
          resultRef.current = outcome;
          if (outcome === "won") {
            const wonCall = lockedCall;
            setXp((current) => current + (wonCall?.xp ?? 0));
            setStreak((current) => current + 1);
            setVerifiedCalls((current) => current.some((call) => call.eventId === event.id)
              ? current
              : [...current, {
                predictionId: prediction,
                eventId: event.id,
                minute: event.minute,
                xp: wonCall?.xp ?? 0,
              }]);
          } else {
            setStreak(0);
          }
        }
      }

      if (isStoryTrigger(event.kind)) {
        const nextTrigger = replayFrames.slice(index + 1).find((frame) => isStoryTrigger(frame.kind));
        const deadline = nextTrigger?.minute ?? Math.min(90, event.minute + 10);
        void requestRound(event as StoryEvent, deadline);
      }

      if (index === replayFrames.length - 1) setPlaying(false);
    }, event.delayMs));

    return () => timers.forEach(window.clearTimeout);
  }, [playing, replayFrames, requestRound]);

  const picks = story.calls;
  const activePick = useMemo(() => picks.find((pick) => pick.id === selected), [picks, selected]);
  const replayMarketShift = marketShift ?? openingSnapshotRef.current?.marketShift ?? null;
  const directorLabel = directorState === "directing"
    ? "AI WRITING FROM VERIFIED EVENT…"
    : directorState === "ollama" ? "OLLAMA HEADLINE" : "SAFE HEADLINE FALLBACK";
  const replayActionLabel = replayLoading
    ? "Loading TxLINE…"
    : playing ? "Pause replay"
      : round.eventId === OPENING_EVENT.id ? "Start replay" : "Reset demo";

  function lockPick(id: PredictionId) {
    if (selected || (directorState === "directing" && round.eventId !== OPENING_EVENT.id)) return;
    setSelected(id);
    selectedRef.current = id;
    setResult("pending");
    resultRef.current = "pending";
  }

  const resetDemo = useCallback(() => {
    setPlaying(false);
    setReplayLoading(false);
    directorControllerRef.current?.abort();
    stopRecap();
    const opening = openingSnapshotRef.current;
    if (opening) {
      setStory(opening.story);
      storyRef.current = opening.story;
      setDirectorState(opening.story.source);
      setMarketShift(opening.marketShift);
      setRound(opening.round);
      roundRef.current = opening.round;
    } else {
      void requestRound(OPENING_EVENT, DEMO_DEADLINE_MINUTE);
    }
    setMinute(DEMO_START_MINUTE);
    setScore({ home: 1, away: 1 });
    setLastEvent("Goal · Belgium");
    setSelected(null);
    selectedRef.current = null;
    setResult("pending");
    resultRef.current = "pending";
    setXp(2310);
    setStreak(4);
    setVerifiedCalls([]);
    setVerifiedReplay(false);
    setReplayFrames(DEMO_FALLBACK);
  }, [requestRound, stopRecap]);

  async function toggleReplay() {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (roundRef.current.eventId !== OPENING_EVENT.id) {
      resetDemo();
      return;
    }

    setReplayLoading(true);
    setMinute(DEMO_START_MINUTE);
    setLastEvent("Goal · Belgium");
    setResult("pending");
    resultRef.current = "pending";
    try {
      setReplayFrames(await loadVerifiedDemoReplay());
      setVerifiedReplay(true);
    } catch {
      setReplayFrames(DEMO_FALLBACK);
      setVerifiedReplay(false);
    }
    setReplayLoading(false);
    setPlaying(true);
  }

  function speakRecap() {
    void playRecap(story.recap);
  }

  function scrollToProof() {
    document.getElementById("solana-proof")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function startJudgePitch() {
    setActiveFixtureId(DEMO_MATCH.fixtureId);
    const url = new URL(window.location.href);
    url.searchParams.delete("fixture");
    window.history.replaceState(null, "", url);
    resetDemo();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectMatch(fixtureId: number) {
    setActiveFixtureId(fixtureId);
    const url = new URL(window.location.href);
    if (fixtureId === DEMO_MATCH.fixtureId) url.searchParams.delete("fixture");
    else url.searchParams.set("fixture", String(fixtureId));
    window.history.replaceState(null, "", url);
    setPlaying(false);
    if (fixtureId === DEMO_MATCH.fixtureId) {
      resetDemo();
      return;
    }
    directorControllerRef.current?.abort();
    stopRecap();
  }

  const judgeCompleted = verifiedCalls.length >= 2 && Boolean(proofSignature);
  let judgeAction: JudgeAction;
  if (judgeCompleted) {
    judgeAction = {
      label: "Achievement verified on Solana",
      detail: "Finish: two TxLINE-resolved calls, 350 XP, one RPC-verified wallet-signed Memo.",
    };
  } else if (verifiedCalls.length >= 2) {
    judgeAction = walletConnected ? {
      label: "Stamp achievement on Solana",
      detail: "The fan signs a Memo with both resolved event IDs and 350 session XP; the app then verifies it via RPC.",
      onClick: scrollToProof,
    } : {
      label: "Connect the fan wallet",
      detail: "Now turn TxLINE-resolved participation into a wallet-signed fan achievement on Solana devnet.",
      onClick: scrollToProof,
    };
  } else if (verifiedCalls.length === 1) {
    if (directorState === "directing") {
      judgeAction = {
        label: "Let Ollama narrate round two",
        detail: "AI writes the emotional headline; deterministic rules create the calls and TxLINE resolves them.",
        disabled: true,
      };
    } else if (!selected) {
      judgeAction = {
        label: "Lock Spain shot on target",
        detail: "Say: every verified event creates a fresh, contextual participation loop.",
        onClick: () => lockPick("shot"),
      };
    } else {
      judgeAction = {
        label: "Watch TxLINE resolve at 60′",
        detail: "No oracle theater: the recorded source event settles the call automatically.",
        disabled: true,
      };
    }
  } else if (!selected) {
    judgeAction = {
      label: "Lock Spain yellow card",
      detail: "Say: fans predict the next narrative beat for XP — never money.",
      onClick: () => lockPick("card"),
    };
  } else if (!playing) {
    judgeAction = {
      label: "Start verified replay",
      detail: "Say: TxLINE is the source of truth; AI never decides who wins the call.",
      onClick: () => void toggleReplay(),
      disabled: replayLoading,
    };
  } else {
    judgeAction = {
      label: "Watch TxLINE resolve at 42′",
      detail: "The compressed replay preserves the original minute, order, team, and event ID.",
      disabled: true,
    };
  }

  return (
    <main>
      <header className="nav shell">
        <a className="brand" href="#top" aria-label="Plot Twist home">
          <span className="brandMark"><Lightning weight="fill" /></span>
          PLOT <i>TWIST</i>
        </a>
        <div className="navActions">
          <div className="livePill"><span /> {activeFixtureId !== DEMO_MATCH.fixtureId ? "TXLINE MATCH CENTER" : playing ? `REPLAY · ${lastEvent.toUpperCase()}` : replayLoading ? "LOADING TXLINE REPLAY" : `TXLINE REPLAY · ${DEMO_MATCH.home.code} vs ${DEMO_MATCH.away.code}`}</div>
          <button className={`judgeNavButton ${judgeOpen ? "active" : ""}`} onClick={() => setJudgeOpen((current) => !current)}>
            <Lightning weight="fill" /> Judge mode
          </button>
          <div className="trustPill" aria-label={activeFixtureId === DEMO_MATCH.fixtureId ? `${xp.toLocaleString("en-US")} experience points` : "Free fan play with no wager"}>
            <ShieldCheck weight="fill" />
            <span>{activeFixtureId === DEMO_MATCH.fixtureId ? `${xp.toLocaleString("en-US")} XP` : "FREE · NO WAGER"}</span>
          </div>
        </div>
      </header>

      <JudgeMode
        open={judgeOpen}
        onClose={() => setJudgeOpen(false)}
        onStart={startJudgePitch}
        action={judgeAction}
        verifiedCallCount={verifiedCalls.length}
        completed={judgeCompleted}
      />

      <MatchSelector selectedFixtureId={activeFixtureId} onSelect={selectMatch} />

      {activeFixtureId === DEMO_MATCH.fixtureId ? <>

      <section className="hero shell" id="top">
        <div className="eyebrow"><span>VERIFIED MATCH REPLAY</span><span>Powered by TxLINE</span></div>
        <div className="scoreline">
          <div className="team left"><span>{DEMO_MATCH.home.name.toUpperCase()}</span><b>{DEMO_MATCH.home.code}</b><em>{DEMO_MATCH.home.flag}</em></div>
          <div className="score"><strong>{score.home}</strong><i>—</i><strong>{score.away}</strong><small>{minute}:14</small></div>
          <div className="team"><em>{DEMO_MATCH.away.flag}</em><b>{DEMO_MATCH.away.code}</b><span>{DEMO_MATCH.away.name.toUpperCase()}</span></div>
        </div>
        <div className="timeline">
          <span className="fill" style={{ width: `${Math.min(86, 15 + minute)}%` }} />
          <span className="event one">⚽ 29&apos;</span>
          <span className="event two">⚽ 40&apos;</span>
          <span className="event three">🟨 42&apos;</span>
          <span className="now" style={{ left: `${Math.min(86, 15 + minute)}%` }} />
        </div>
        <div className="marketTicker">
          <span><i className={replayMarketShift ? "live" : "connecting"} /> {DEMO_MATCH.competition.toUpperCase()} · TXLINE FIXTURE {DEMO_MATCH.fixtureId} · HISTORICAL REPLAY</span>
          {replayMarketShift ? (
            <strong>
              {DEMO_MATCH.away.code} WIN SIGNAL <b>{formatProbability(replayMarketShift.before)}%</b> → {formatProbability(replayMarketShift.after)}%
            </strong>
          ) : <strong>Loading same-fixture TxLINE odds history…</strong>}
        </div>
      </section>

      <section className="experience shell">
        <article className={`storyCard ${directorState === "directing" ? "directing" : ""}`} aria-live="polite">
          <div className="storyGlow" />
          <div className="cardTop">
            <span className="twistTag"><Lightning weight="fill" /> THE PLOT JUST FLIPPED · {directorLabel}</span>
            <button
              className={`iconButton ${voiceState === "speaking" || voiceState === "fallback" ? "speaking" : ""}`}
              aria-label="Play verified match recap"
              onClick={speakRecap}
              disabled={directorState === "directing" || voiceState === "loading"}
            ><SpeakerHigh /></button>
          </div>
          <h1>{story.headlineLead}<br /><em>{story.headlineAccent}</em></h1>
          <p>{story.explanation}</p>
          <div className="probability">
            <div>
              <span>{marketShift ? story.marketLabel : "Live event context"}</span>
              <b>{marketShift ? "Verified TxLINE shift" : "Verified TxLINE event"} · {round.minute}&apos;</b>
            </div>
            {marketShift ? <>
              <div className="probNumbers">
                <del>{formatProbability(marketShift.before)}%</del>
                <ArrowRight />
                <strong>{formatProbability(marketShift.after)}%</strong>
              </div>
              <div className="meter"><span style={{ width: `${marketShift.after}%` }} /></div>
            </> : (
              <div className="eventPulse">
                <span><Lightning weight="fill" /> {eventName(round.trigger)}</span>
                <strong>{round.triggerTeam}</strong>
              </div>
            )}
          </div>
          <button className="listen" onClick={speakRecap} disabled={directorState === "directing" || voiceState === "loading"}>
            <Play weight="fill" />
            {voiceState === "loading" ? "Preparing studio voice…"
              : voiceState === "speaking" ? "Playing ElevenLabs recap…"
                : voiceState === "fallback" ? "Browser voice fallback…"
                  : voiceState === "unsupported" ? "Voice unavailable in this browser"
                    : "Hear the 12-sec verified recap"}
            {story.latencyMs && voiceState === "idle" ? ` · directed in ${(story.latencyMs / 1000).toFixed(1)}s` : ""}
          </button>
        </article>

        <aside className="callCard">
          <div className="callTitle">
            <span><Lightning weight="fill" /></span>
            <div><small>YOUR TURN</small><h2>Call the next twist</h2></div>
          </div>
          <b className="deadlineBadge">LOCKS AT {round.deadlineMinute}:00</b>
          <p className="subcopy">Choose one outcome before the verified window closes.</p>
          <div className="picks">
            {picks.map((pick, index) => {
              const isSelected = selected === pick.id;
              const isWinner = result === "won" && selected === pick.id;
              return (
                <button
                  className={`pick ${isSelected ? "selected" : ""} ${isWinner ? "winner" : ""}`}
                  key={pick.id}
                  onClick={() => lockPick(pick.id as PredictionId)}
                  disabled={Boolean(selected) || (directorState === "directing" && round.eventId !== OPENING_EVENT.id)}
                >
                  <span className="pickIndex">{isWinner ? <CheckCircle weight="fill" /> : index + 1}</span>
                  <span><b>{pick.label}</b><small>{pick.detail}</small></span>
                  <strong>+{pick.xp}<small>XP</small></strong>
                </button>
              );
            })}
          </div>
          {activePick ? (
            <div className={`locked ${result === "won" ? "success" : result === "lost" ? "missed" : ""}`} role="status">
              {result === "won" ? <><Trophy weight="fill" /> Correct call! +{activePick.xp} XP</> : result === "lost" ? <>Time&apos;s up — the streak resets</> : directorState === "directing" ? <><span className="spinner" /> Event verified — AI directing next round…</> : <><span className="spinner" /> Call locked — watching TxLINE…</>}
            </div>
          ) : directorState === "directing" ? (
            <div className="locked"><span className="spinner" /> Ollama writes while deterministic rules prepare the calls…</div>
          ) : (
            <div className="confidence"><span>How rewards work</span><b>Less likely = more XP</b></div>
          )}
        </aside>
      </section>

      <WalletAchievement
        fixtureId={OPENING_EVENT.fixtureId}
        calls={verifiedCalls}
        onWalletStatusChange={setWalletConnected}
        onProofConfirmed={setProofSignature}
      />

      <section className="lower shell">
        <div className="streakCard">
          <Fire weight="fill" />
          <div><span>CURRENT STREAK</span><strong>{streak} {streak === 1 ? "call" : "calls"} on fire</strong></div>
          <div className="dots">{Array.from({ length: 5 }, (_, index) => <i className={index >= Math.min(streak, 5) ? "empty" : ""} key={index} />)}</div>
        </div>
        <div className="friendsCard">
          <div className="sectionLabel"><UsersThree /> FRIENDS&apos; ROOM <span>Matchday crew</span></div>
          <div className="leaders">
            {leaders.map((leader, index) => (
              <div className="leader" key={leader.name}>
                <span>{index + 1}</span><i style={{ background: leader.color }}>{leader.name[0]}</i>
                <b>{leader.name}</b><strong>{(leader.name === "You" ? xp : leader.score).toLocaleString("en-US")} XP</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="replayCard">
          <span className="sectionLabel"><Play weight="fill" /> DEMO CONTROL</span>
          <h3>Replay the live drama</h3>
          <p>{verifiedReplay ? "Verified TxLINE events now trigger new AI rounds and resolve every locked call." : round.eventId === OPENING_EVENT.id ? "Pick Spain yellow card, then start the verified multi-round replay." : "Reset to the opening goal and run the full judge flow again."}</p>
          <button
            onClick={toggleReplay}
            disabled={replayLoading || (!playing && round.eventId === OPENING_EVENT.id && directorState === "directing" && !selected)}
          ><Play weight="fill" /> {replayActionLabel}</button>
        </div>
      </section>

      </> : <SelectedMatchExperience fixtureId={activeFixtureId} />}

      <section className="businessStrip shell">
        <div><small>COMMERCIAL PATH · B2B2C</small><h2>The live fan layer that writes itself from verified match data.</h2></div>
        <p>Broadcasters, clubs, and media platforms license PLOT TWIST per tournament or active fan. TxLINE triggers sponsorable rounds automatically; fans always play free.</p>
        <div className="businessTags"><span>Automatic story rounds</span><span>Fan loyalty</span><span>Sponsor inventory</span></div>
      </section>

      <footer className="shell"><span>Live data by <b>TxLINE</b></span><span>Built for the World Cup · On Solana</span></footer>
    </main>
  );
}
