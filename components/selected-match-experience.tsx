"use client";

import { CircleNotch, Lightning } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import {
  LiveMatchPanel,
  PostMatchPanel,
  UpcomingMatchPanel,
} from "@/components/match-phase-panels";
import { isStoryEventKind, type MatchEvent } from "@/lib/match-events";
import type { MatchDetail, MatchTimelineEvent } from "@/lib/matches";

type SelectedMatchExperienceProps = { fixtureId: number };

const PHASE_LABEL = {
  past: "FULL TIME",
  live: "LIVE NOW",
  upcoming: "UPCOMING",
} as const;

const EVENT_META = {
  goal: { icon: "⚽", label: "Goal" },
  yellow_card: { icon: "🟨", label: "Yellow card" },
  red_card: { icon: "🟥", label: "Red card" },
  shot_on_target: { icon: "🎯", label: "Shot on target" },
  corner: { icon: "🚩", label: "Corner" },
  odds_shift: { icon: "⚡", label: "Odds shift" },
} as const;

function kickoffLabel(startTime: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(startTime));
}

function eventPosition(event: MatchTimelineEvent) {
  return `${Math.min(96, Math.max(3, (event.minute / 90) * 100))}%`;
}

export function SelectedMatchExperience({ fixtureId }: SelectedMatchExperienceProps) {
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let refreshTimer: number | undefined;
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(`/api/matches/${fixtureId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json() as MatchDetail & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Match data unavailable");
        if (!active) return;

        setMatch(payload);
        setError(null);
        setLoading(false);
        if (payload.phase !== "past") {
          const untilKickoff = Date.parse(payload.startTime) - Date.now();
          const delay = payload.phase === "live"
            ? 15_000
            : Math.max(15_000, Math.min(60_000, untilKickoff));
          refreshTimer = window.setTimeout(() => void load(), delay);
        }
      } catch (reason) {
        if (active && !controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Match data unavailable");
          setLoading(false);
        }
      }
    }

    setLoading(true);
    setMatch(null);
    void load();
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(refreshTimer);
    };
  }, [fixtureId]);

  const applyVerifiedEvent = useCallback((event: MatchEvent) => {
    setMatch((current) => {
      if (!current || current.fixtureId !== event.fixtureId) return current;
      const timelineKind = isStoryEventKind(event.kind)
        && event.kind !== "odds_shift"
        && event.kind !== "match_started"
        && event.kind !== "live_state"
        ? event.kind
        : null;
      const eventMeta = timelineKind ? EVENT_META[timelineKind] : null;
      const timelineEvent: MatchTimelineEvent | null = timelineKind && eventMeta ? {
        id: event.id,
        seq: event.seq,
        minute: event.minute,
        kind: timelineKind,
        icon: eventMeta.icon,
        label: eventMeta.label,
        team: event.team ?? null,
        teamName: event.team === "home" ? current.home.name : event.team === "away" ? current.away.name : null,
        occurredAt: event.occurredAt,
      } : null;
      const events = timelineEvent && !current.events.some((candidate) => candidate.id === timelineEvent.id)
        ? [timelineEvent, ...current.events].sort((a, b) => b.seq - a.seq).slice(0, 10)
        : current.events;

      return {
        ...current,
        phase: event.kind === "match_finished" ? "past" : "live",
        score: { home: event.homeScore, away: event.awayScore },
        minute: Math.max(current.minute ?? 0, event.minute),
        clockRunning: event.kind !== "match_finished",
        events,
        coverage: { ...current.coverage, scores: true },
      };
    });
  }, []);

  if (loading) {
    return (
      <section className="matchDataState shell" aria-live="polite">
        <CircleNotch className="spinIcon" />
        <div><b>Loading full TxLINE match data…</b><span>Score, key events, odds and lineups</span></div>
      </section>
    );
  }

  if (error || !match) {
    return (
      <section className="matchDataState error shell" role="alert">
        <Lightning />
        <div><b>Fixture found, details unavailable.</b><span>{error ?? "TxLINE returned no usable data."}</span></div>
      </section>
    );
  }

  const displayEvents = [...match.events].reverse().slice(-4);
  const progress = match.phase === "past" ? 100 : match.phase === "upcoming"
    ? 0 : Math.min(100, ((match.minute ?? 0) / 90) * 100);
  const clock = match.phase === "live" ? `${match.minute ?? 0}′ ${match.clockRunning ? "LIVE" : "PAUSED"}`
    : match.phase === "past" ? "FULL TIME" : kickoffLabel(match.startTime);

  return (
    <>
      <section className="hero shell selectedMatchHero" id="top">
        <div className="eyebrow">
          <span>{PHASE_LABEL[match.phase]} · VERIFIED MATCH</span>
          <span>Powered by TxLINE</span>
        </div>
        <div className="scoreline">
          <div className="team left"><span>{match.home.name.toUpperCase()}</span><b>{match.home.code}</b><em>{match.home.flag}</em></div>
          <div className="score">
            <strong>{match.score?.home ?? "—"}</strong><i>—</i><strong>{match.score?.away ?? "—"}</strong>
            <small>{clock}</small>
          </div>
          <div className="team"><em>{match.away.flag}</em><b>{match.away.code}</b><span>{match.away.name.toUpperCase()}</span></div>
        </div>
        <div className="timeline">
          <span className="fill" style={{ width: `${progress}%` }} />
          {displayEvents.map((event) => (
            <span className="event selectedEvent" style={{ left: eventPosition(event) }} key={event.id}>{event.icon} {event.minute}&apos;</span>
          ))}
          {match.phase === "live" && <span className="now" style={{ left: `${progress}%` }} />}
        </div>
        <div className="marketTicker">
          <span><i className={match.phase === "live" ? "live" : "connecting"} /> {match.competition.toUpperCase()} · TXLINE FIXTURE {match.fixtureId} · {PHASE_LABEL[match.phase]}</span>
          {match.odds ? <strong>1X2 · {match.home.code} <b>{match.odds.homePct.toFixed(1)}%</b> · DRAW <b>{match.odds.drawPct.toFixed(1)}%</b> · {match.away.code} <b>{match.odds.awayPct.toFixed(1)}%</b></strong>
            : <strong>NO 1X2 ODDS SNAPSHOT AVAILABLE</strong>}
        </div>
      </section>

      {match.phase === "live" ? <LiveMatchPanel match={match} onVerifiedEvent={applyVerifiedEvent} />
        : match.phase === "upcoming" ? <UpcomingMatchPanel match={match} />
          : <PostMatchPanel match={match} />}
    </>
  );
}
