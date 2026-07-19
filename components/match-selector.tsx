"use client";

import { CalendarBlank, CaretDown, CheckCircle, CircleNotch } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import type { MatchCatalogItem, MatchPhase } from "@/lib/matches";

type MatchSelectorProps = {
  selectedFixtureId: number;
  onSelect: (fixtureId: number) => void;
};

const PHASES: Array<{ id: MatchPhase; label: string }> = [
  { id: "past", label: "Finished" },
  { id: "live", label: "Live now" },
  { id: "upcoming", label: "Upcoming" },
];
const CATALOG_STORAGE_KEY = "plot-twist-match-catalog";

function matchTime(match: MatchCatalogItem) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(match.startTime));
}

export function MatchSelector({ selectedFixtureId, onSelect }: MatchSelectorProps) {
  const [matches, setMatches] = useState<MatchCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    try {
      const cached = JSON.parse(
        window.localStorage.getItem(CATALOG_STORAGE_KEY) ?? "[]",
      ) as MatchCatalogItem[];
      if (Array.isArray(cached) && cached.length > 0) {
        setMatches(cached);
        setLoading(false);
      }
    } catch {
      window.localStorage.removeItem(CATALOG_STORAGE_KEY);
    }

    fetch("/api/matches", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { matches?: MatchCatalogItem[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Match catalog unavailable");
        const nextMatches = payload.matches ?? [];
        setMatches(nextMatches);
        window.localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(nextMatches));
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Match catalog unavailable");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const selected = useMemo(
    () => matches.find((match) => match.fixtureId === selectedFixtureId),
    [matches, selectedFixtureId],
  );

  return (
    <section className="matchSelector shell" aria-label="Choose a football match">
      <div className="matchSelectorIntro">
        <span><CalendarBlank weight="fill" /> MATCH CENTER</span>
        <h2>Turn any live match into a story you can play.</h2>
        <p>Verified TxLINE events · one-tap fan calls · XP, never wagers.</p>
      </div>

      <div className="matchSelectorControl">
        <div className="phaseCounts" aria-label="Match availability">
          {PHASES.map((phase) => {
            const count = matches.filter((match) => match.phase === phase.id).length;
            return (
              <span className={phase.id} key={phase.id}>
                {phase.id === "live" && <i />}{phase.label} <b>{loading ? "–" : count}</b>
              </span>
            );
          })}
        </div>
        <label className="matchSelect">
          <span className="srOnly">Football match</span>
          {loading ? <CircleNotch className="spinIcon" /> : <CheckCircle weight="fill" />}
          <select
            value={selectedFixtureId}
            onChange={(event) => onSelect(Number(event.target.value))}
            disabled={loading && matches.length === 0}
          >
            {!selected && <option value={selectedFixtureId}>Current demo fixture</option>}
            {PHASES.map((phase) => (
              <optgroup label={phase.label} key={phase.id}>
                {matches
                  .filter((match) => match.phase === phase.id)
                  .map((match) => (
                    <option value={match.fixtureId} key={match.fixtureId}>
                      {match.home.name} — {match.away.name} · {matchTime(match)}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <CaretDown />
        </label>
        {error ? (
          <p className="matchSelectorError">Live refresh paused: {error}. Cached verified fixtures remain available.</p>
        ) : selected ? (
          <p className="selectedMatchMeta">
            <b>{selected.phase}</b> · TxLINE fixture {selected.fixtureId} · {matchTime(selected)}
          </p>
        ) : <p className="selectedMatchMeta">Loading tournament coverage…</p>}
      </div>
    </section>
  );
}
