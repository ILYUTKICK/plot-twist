"use client";

import {
  CalendarBlank,
  CheckCircle,
  CircleNotch,
  Fire,
  Lightning,
  ListBullets,
  LockSimple,
  Play,
  SpeakerHigh,
  Target,
  Trophy,
  UsersThree,
  XCircle,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTxlineScoreStream } from "@/hooks/use-txline-score-stream";
import type { VerifiedCallProof } from "@/lib/achievements";
import {
  emptyFanSession,
  parseFanSession,
  sessionAccuracy,
  settleFanCall,
  type ActiveFanCall,
  type FanSession,
  type SettledFanCall,
} from "@/lib/fan-session";
import {
  isStoryEventKind,
  predictionDeadlineFor,
  type MatchEvent,
  type PredictionId,
  type TeamSide,
} from "@/lib/match-events";
import type { MatchDetail, MatchTimelineEvent } from "@/lib/matches";
import { fallbackFor, type DirectedStory, type StoryDirectorInput } from "@/lib/story";

const WalletAchievement = dynamic(
  () => import("@/components/wallet-achievement").then((module) => module.WalletAchievement),
  { ssr: false },
);

type MatchPanelProps = { match: MatchDetail };
type LiveMatchPanelProps = MatchPanelProps & { onVerifiedEvent: (event: MatchEvent) => void };

type LiveRound = {
  event: MatchEvent;
  deadlineMinute: number;
};

const EVENT_NAME = {
  match_started: "Verified live clock",
  live_state: "Verified live clock",
  goal: "Goal",
  yellow_card: "Yellow card",
  red_card: "Red card",
  shot_on_target: "Shot on target",
  corner: "Corner",
  odds_shift: "Odds shift",
} as const;

function sessionKey(fixtureId: number) {
  return `plot-twist-fan-session:${fixtureId}`;
}

function kickoffLabel(startTime: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(startTime));
}

function teamName(match: MatchDetail, side?: TeamSide | null) {
  return side === "home" ? match.home.name : side === "away" ? match.away.name : "Match";
}

function timelineToMatchEvent(
  event: MatchTimelineEvent,
  match: MatchDetail,
  score: NonNullable<MatchDetail["score"]>,
): MatchEvent {
  return {
    id: event.id,
    fixtureId: match.fixtureId,
    seq: event.seq,
    kind: event.kind,
    minute: event.minute,
    team: event.team ?? undefined,
    homeScore: score.home,
    awayScore: score.away,
    occurredAt: event.occurredAt,
    source: "txline",
  };
}

function verifiedProofs(session: FanSession): VerifiedCallProof[] {
  return session.records
    .filter((record) => record.result === "won")
    .slice(-2)
    .map((record) => ({
      predictionId: record.predictionId,
      eventId: record.settledByEventId,
      minute: record.settledMinute,
      xp: record.xp,
    }));
}

function CoverageChips({ match }: MatchPanelProps) {
  return (
    <div className="coverageRow">
      <span className={match.coverage.scores ? "ready" : ""}>Scores</span>
      <span className={match.coverage.odds ? "ready" : ""}>Odds</span>
      <span className={match.coverage.lineups ? "ready" : ""}>Lineups</span>
    </div>
  );
}

function MatchArchive({ match }: MatchPanelProps) {
  return (
    <aside className="callCard matchDetailsCard">
      <div className="callTitle">
        <span><ListBullets weight="fill" /></span>
        <div><small>TXLINE COVERAGE</small><h2>Verified match data</h2></div>
      </div>
      <div className="matchFacts">
        <span><CalendarBlank /><b>Kickoff</b><small>{kickoffLabel(match.startTime)}</small></span>
        <span><CheckCircle /><b>Fixture</b><small>#{match.fixtureId} · {match.competition}</small></span>
        <span><UsersThree /><b>Lineups</b><small>{match.lineups.reduce((sum, item) => sum + item.starters.length, 0)} starters published</small></span>
      </div>
      <div className="matchDataSection">
        <div className="matchDataHeading"><Lightning weight="fill" /> VERIFIED KEY EVENTS <b>{match.events.length}</b></div>
        {match.events.length ? (
          <div className="eventList">
            {match.events.slice(0, 8).map((event) => (
              <span key={event.id}><i>{event.icon}</i><b>{event.label}</b><small>{event.teamName ?? "Match"} · {event.minute}′</small></span>
            ))}
          </div>
        ) : <p className="emptyCoverage">No supported key-event snapshot is available.</p>}
      </div>
      <details className="lineupDetails">
        <summary><UsersThree weight="fill" /> STARTING LINEUPS <b>{match.lineups.reduce((sum, item) => sum + item.starters.length, 0)}</b></summary>
        {match.lineups.length ? match.lineups.map((lineup) => (
          <div key={lineup.team}><strong>{lineup.team}</strong><p>{lineup.starters.join(" · ") || "Not published"}</p></div>
        )) : <p className="emptyCoverage">Lineups have not been published for this fixture.</p>}
      </details>
      {match.conditions.length > 0 && <p className="conditions">CONDITIONS · {match.conditions.join(" · ")}</p>}
    </aside>
  );
}

export function UpcomingMatchPanel({ match }: MatchPanelProps) {
  return (
    <section className="experience shell selectedMatchExperience upcomingExperience">
      <article className="storyCard">
        <div className="storyGlow" />
        <div className="cardTop">
          <span className="twistTag"><CalendarBlank weight="fill" /> VERIFIED MATCH PREVIEW</span>
          <span className="iconButton dataIcon"><LockSimple /></span>
        </div>
        <h1>{match.home.name} meet {match.away.name}.<br /><em>The plot has not started yet.</em></h1>
        <p>Kickoff is scheduled for {kickoffLabel(match.startTime)}. PLOT TWIST will unlock fan calls only after TxLINE confirms the match has started.</p>
        <div className="probability">
          <div><span>Pre-match availability</span><b>Nothing is fabricated</b></div>
          {match.odds ? (
            <div className="oddsTriplet">
              <span>{match.home.code}<b>{match.odds.homePct.toFixed(1)}%</b></span>
              <span>DRAW<b>{match.odds.drawPct.toFixed(1)}%</b></span>
              <span>{match.away.code}<b>{match.odds.awayPct.toFixed(1)}%</b></span>
            </div>
          ) : <div className="eventPulse"><span><LockSimple weight="fill" /> ODDS NOT PUBLISHED</span><strong>PREVIEW</strong></div>}
        </div>
        <CoverageChips match={match} />
      </article>
      <aside className="callCard upcomingCalls">
        <div className="callTitle"><span><LockSimple weight="fill" /></span><div><small>FAN CALLS</small><h2>Unlock at kickoff</h2></div></div>
        <p className="subcopy">Prediction cards require a verified live clock and fixture-scoped score feed.</p>
        {["Team shot on target", "Team yellow card", "Another goal"].map((label, index) => (
          <div className="pick lockedPreview" key={label}>
            <span className="pickIndex">{index + 1}</span><span><b>{label}</b><small>Available when the match goes live</small></span><LockSimple />
          </div>
        ))}
        <div className="locked"><LockSimple /> Waiting for TxLINE match start</div>
      </aside>
    </section>
  );
}

export function LiveMatchPanel({ match, onVerifiedEvent }: LiveMatchPanelProps) {
  const [round, setRound] = useState<LiveRound | null>(null);
  const [story, setStory] = useState<DirectedStory | null>(null);
  const [directorState, setDirectorState] = useState<"directing" | "ollama" | "fallback">("fallback");
  const [activeCall, setActiveCall] = useState<ActiveFanCall | null>(null);
  const [lastSettlement, setLastSettlement] = useState<SettledFanCall | null>(null);
  const [session, setSession] = useState<FanSession>(() => emptyFanSession(match.fixtureId));
  const [sessionReady, setSessionReady] = useState(false);
  const [voiceState, setVoiceState] = useState<"idle" | "speaking" | "unsupported">("idle");
  const processedRef = useRef(new Set<string>());
  const initialisedRef = useRef(false);
  const activeCallRef = useRef<ActiveFanCall | null>(null);
  const sessionRef = useRef(session);
  const directorRef = useRef<AbortController | null>(null);
  const { events: streamedEvents, streamState } = useTxlineScoreStream(match.fixtureId, true);

  activeCallRef.current = activeCall;
  sessionRef.current = session;

  useEffect(() => {
    const restored = parseFanSession(
      window.localStorage.getItem(sessionKey(match.fixtureId)),
      match.fixtureId,
    );
    setSession(restored);
    sessionRef.current = restored;
    setSessionReady(true);
    processedRef.current = new Set();
    initialisedRef.current = false;
    return () => directorRef.current?.abort();
  }, [match.fixtureId]);

  useEffect(() => {
    if (!sessionReady) return;
    window.localStorage.setItem(sessionKey(match.fixtureId), JSON.stringify(session));
  }, [match.fixtureId, session, sessionReady]);

  const beginRound = useCallback(async (event: MatchEvent) => {
    if (!isStoryEventKind(event.kind)) return;
    const triggerTeam = teamName(match, event.team);
    const deadlineMinute = predictionDeadlineFor(event.minute);
    if ((match.minute ?? event.minute) >= deadlineMinute) return;

    const context: StoryDirectorInput = {
      fixtureId: match.fixtureId,
      homeTeam: match.home.name,
      awayTeam: match.away.name,
      triggerTeam,
      trigger: event.kind,
      minute: event.minute,
      deadlineMinute,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
      marketBefore: 0,
      marketAfter: 0,
      marketVerified: false,
    };
    setRound({ event, deadlineMinute });
    setStory(fallbackFor(context));
    if (event.kind === "live_state") {
      setDirectorState("fallback");
      directorRef.current?.abort();
      return;
    }
    setDirectorState("directing");
    directorRef.current?.abort();
    const controller = new AbortController();
    directorRef.current = controller;
    try {
      const response = await fetch("/api/story-director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Story Director unavailable");
      const directed = await response.json() as DirectedStory;
      if (!controller.signal.aborted) {
        setStory(directed);
        setDirectorState(directed.source);
      }
    } catch {
      if (!controller.signal.aborted) setDirectorState("fallback");
    }
  }, [match]);

  const processEvent = useCallback((event: MatchEvent) => {
    if (event.fixtureId !== match.fixtureId || processedRef.current.has(event.id)) return;
    processedRef.current.add(event.id);
    onVerifiedEvent(event);

    const currentCall = activeCallRef.current;
    if (currentCall) {
      const settled = settleFanCall(sessionRef.current, currentCall, event);
      if (settled.record) {
        sessionRef.current = settled.session;
        setSession(settled.session);
        window.localStorage.setItem(sessionKey(match.fixtureId), JSON.stringify(settled.session));
        setLastSettlement(settled.record);
        setActiveCall(null);
        activeCallRef.current = null;
      } else {
        return;
      }
    }

    if (isStoryEventKind(event.kind)) void beginRound(event);
  }, [beginRound, match.fixtureId, onVerifiedEvent]);

  useEffect(() => {
    if (!sessionReady || !match.score) return;
    const ordered = [...match.events].sort((a, b) => a.seq - b.seq);
    if (!initialisedRef.current) {
      ordered.forEach((event) => processedRef.current.add(event.id));
      initialisedRef.current = true;
      const currentMinute = match.minute ?? 0;
      const latest = [...ordered].reverse().find((event) => (
        isStoryEventKind(event.kind) && currentMinute < predictionDeadlineFor(event.minute)
      ));
      if (latest) {
        void beginRound(timelineToMatchEvent(latest, match, match.score));
      } else {
        void beginRound({
          id: `${match.fixtureId}-live-state-${currentMinute}`,
          fixtureId: match.fixtureId,
          seq: Math.max(0, ...ordered.map((event) => event.seq)) + 1,
          kind: "live_state",
          minute: currentMinute,
          team: "home",
          homeScore: match.score.home,
          awayScore: match.score.away,
          occurredAt: new Date().toISOString(),
          source: "txline",
        });
      }
      return;
    }
    for (const event of ordered) {
      if (!processedRef.current.has(event.id)) {
        processEvent(timelineToMatchEvent(event, match, match.score));
      }
    }
  }, [beginRound, match, processEvent, sessionReady]);

  useEffect(() => {
    for (const event of streamedEvents) processEvent(event);
  }, [processEvent, streamedEvents]);

  useEffect(() => {
    const call = activeCallRef.current;
    const currentMinute = match.minute ?? 0;
    if (!call || !match.score || currentMinute < call.deadlineMinute) return;
    processEvent({
      id: `${match.fixtureId}-clock-${currentMinute}`,
      fixtureId: match.fixtureId,
      seq: Number.MAX_SAFE_INTEGER - currentMinute,
      kind: "live_state",
      minute: currentMinute,
      homeScore: match.score.home,
      awayScore: match.score.away,
      occurredAt: new Date().toISOString(),
      source: "txline",
    });
  }, [match.fixtureId, match.minute, match.score?.away, match.score?.home, processEvent]);

  const lockCall = (predictionId: PredictionId) => {
    if (!round || !story || activeCall) return;
    const call = story.calls.find((candidate) => candidate.id === predictionId);
    if (!call) return;
    const locked: ActiveFanCall = {
      ...call,
      roundEventId: round.event.id,
      deadlineMinute: round.deadlineMinute,
    };
    setActiveCall(locked);
    activeCallRef.current = locked;
    setLastSettlement(null);
  };

  const speak = () => {
    if (!story || !("speechSynthesis" in window)) {
      setVoiceState("unsupported");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(story.recap);
    utterance.lang = "en-US";
    utterance.rate = 1.03;
    utterance.onstart = () => setVoiceState("speaking");
    utterance.onend = () => setVoiceState("idle");
    utterance.onerror = () => setVoiceState("idle");
    window.speechSynthesis.speak(utterance);
  };

  const proofs = useMemo(() => verifiedProofs(session), [session]);
  const directorLabel = round?.event.kind === "live_state" ? "VERIFIED STATE TEMPLATE"
    : directorState === "directing" ? "AI DIRECTING…"
      : directorState === "ollama" ? "OLLAMA HEADLINE" : "SAFE FALLBACK";

  return (
    <>
      <section className="experience shell selectedMatchExperience liveMatchExperience">
        <article className={`storyCard ${directorState === "directing" ? "directing" : ""}`}>
          <div className="storyGlow" />
          <div className="cardTop">
            <span className="twistTag"><Lightning weight="fill" /> LIVE PLOT ROUND · {directorLabel}</span>
            <button className={`iconButton ${voiceState === "speaking" ? "speaking" : ""}`} onClick={speak} disabled={!story}><SpeakerHigh /></button>
          </div>
          {story && round ? <>
            <h1>{story.headlineLead}<br /><em>{story.headlineAccent}</em></h1>
            <p>{story.explanation}</p>
            <div className="probability">
              <div><span>Verified event context</span><b>TxLINE · {round.event.minute}′</b></div>
              <div className="eventPulse"><span><Lightning weight="fill" /> {EVENT_NAME[round.event.kind as keyof typeof EVENT_NAME]}</span><strong>{teamName(match, round.event.team)}</strong></div>
            </div>
            <button className="listen" onClick={speak}><Play weight="fill" /> {voiceState === "speaking" ? "Speaking verified recap…" : "Hear the verified recap"}</button>
          </> : <div className="waitingForEvent"><CircleNotch className="spinIcon" /><h1>Waiting for the next<br /><em>verified plot event.</em></h1><p>Calls open after a goal, card, shot on target, or corner from this fixture&apos;s TxLINE feed.</p></div>}
          <div className="liveSessionBar"><span><i className={streamState === "live" ? "live" : "connecting"} /> SCORE STREAM · {streamState.toUpperCase()}</span><b>{session.xp} XP · {session.streak} STREAK</b></div>
        </article>

        <aside className="callCard liveCallCard">
          <div className="callTitle"><span><Target weight="fill" /></span><div><small>YOUR LIVE CALL</small><h2>Call the next twist</h2></div></div>
          {round && <b className="deadlineBadge">LOCKS AT {round.deadlineMinute}:00</b>}
          <p className="subcopy">{round ? `Choose one outcome before the verified window closes.` : "Waiting for a verified trigger from TxLINE."}</p>
          <div className="picks">
            {(story?.calls ?? []).map((call, index) => {
              const selected = activeCall?.id === call.id;
              return (
                <button className={`pick ${selected ? "selected" : ""}`} key={call.id} onClick={() => lockCall(call.id)} disabled={!round || Boolean(activeCall)}>
                  <span className="pickIndex">{index + 1}</span><span><b>{call.label}</b><small>{call.detail}</small></span><strong>+{call.xp}<small>XP</small></strong>
                </button>
              );
            })}
          </div>
          {!story ? <div className="locked" role="status"><CircleNotch className="spinIcon" /> Listening to fixture #{match.fixtureId}</div>
            : activeCall ? <div className="locked" role="status"><CircleNotch className="spinIcon" /> Call locked — TxLINE decides the result</div>
              : lastSettlement ? <div className={`locked ${lastSettlement.result === "won" ? "success" : "missed"}`} role="status">
                {lastSettlement.result === "won" ? <><Trophy weight="fill" /> Correct · +{lastSettlement.xp} XP</> : <><XCircle /> Missed · streak reset</>}
              </div> : <div className="confidence"><span>Free fan challenge</span><b>Truth from TxLINE</b></div>}
          <div className="sessionMiniStats"><span><b>{session.records.length}</b> settled</span><span><b>{sessionAccuracy(session)}%</b> accuracy</span><span><b>{session.bestStreak}</b> best streak</span></div>
        </aside>
      </section>
      <WalletAchievement fixtureId={match.fixtureId} calls={proofs} />
    </>
  );
}

export function PostMatchPanel({ match }: MatchPanelProps) {
  const [session, setSession] = useState<FanSession>(() => emptyFanSession(match.fixtureId));
  useEffect(() => {
    setSession(parseFanSession(window.localStorage.getItem(sessionKey(match.fixtureId)), match.fixtureId));
  }, [match.fixtureId]);
  const won = session.records.filter((record) => record.result === "won").length;
  const proofs = useMemo(() => verifiedProofs(session), [session]);

  return (
    <>
      <section className="experience shell selectedMatchExperience postMatchExperience">
        <article className="storyCard postMatchStory">
          <div className="storyGlow" />
          <div className="cardTop"><span className="twistTag"><CheckCircle weight="fill" /> VERIFIED FINAL · TXLINE</span><span className="iconButton dataIcon"><Trophy /></span></div>
          <h1>{match.home.name} {match.score?.home ?? "—"} — {match.score?.away ?? "—"} {match.away.name}.<br /><em>The story is now complete.</em></h1>
          <p>Prediction cards are closed. This screen contains only the final state and event coverage currently returned for fixture #{match.fixtureId}.</p>
          <div className="finalStatsGrid">
            <span><b>{match.stats?.home.goals ?? "—"}</b>{match.home.code} goals</span>
            <span><b>{match.stats?.away.goals ?? "—"}</b>{match.away.code} goals</span>
            <span><b>{match.stats?.home.corners ?? "—"}</b>{match.home.code} corners</span>
            <span><b>{match.stats?.away.corners ?? "—"}</b>{match.away.code} corners</span>
          </div>
          <CoverageChips match={match} />
        </article>
        <aside className="callCard fanSummaryCard">
          <div className="callTitle"><span><Trophy weight="fill" /></span><div><small>YOUR MATCH SUMMARY</small><h2>{session.records.length ? "Session complete" : "No live calls recorded"}</h2></div></div>
          <div className="fanSummaryHero"><strong>{sessionAccuracy(session)}%</strong><span>accuracy<b>{won}/{session.records.length} correct</b></span></div>
          <div className="summaryMetrics">
            <span><Fire weight="fill" /><b>{session.bestStreak}</b><small>BEST STREAK</small></span>
            <span><Lightning weight="fill" /><b>{session.xp}</b><small>SESSION XP</small></span>
            <span><Target weight="fill" /><b>{session.records.length}</b><small>SETTLED CALLS</small></span>
          </div>
          {session.records.length ? <div className="settledCallList">{session.records.slice(-4).reverse().map((record) => (
            <span key={record.roundEventId}>{record.result === "won" ? <CheckCircle weight="fill" /> : <XCircle />}<b>{record.label}</b><small>{record.result === "won" ? `+${record.xp} XP` : "Missed"} · {record.settledMinute}′</small></span>
          ))}</div> : <p className="emptyCoverage">Open a match while it is live and lock a call to build personal match statistics.</p>}
        </aside>
      </section>
      <section className="experience shell matchArchiveExperience"><div className="archiveIntro"><small>POST-MATCH ARCHIVE</small><h2>What happened in the match</h2><p>Snapshot events, lineups, conditions, and source coverage remain inspectable after fan calls close.</p></div><MatchArchive match={match} /></section>
      <WalletAchievement fixtureId={match.fixtureId} calls={proofs} />
    </>
  );
}
