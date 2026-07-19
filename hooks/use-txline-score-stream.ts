"use client";

import { useEffect, useState } from "react";
import type { MatchEvent } from "@/lib/match-events";
import { normalizeTxlineScore } from "@/lib/txline-normalizer";

export type ScoreStreamState = "idle" | "connecting" | "live" | "reconnecting";

export function useTxlineScoreStream(fixtureId: number, enabled: boolean) {
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [streamState, setStreamState] = useState<ScoreStreamState>("idle");

  useEffect(() => {
    setEvents([]);
    if (!enabled) {
      setStreamState("idle");
      return;
    }

    const seen = new Set<string>();
    let active = true;
    setStreamState("connecting");
    const stream = new EventSource(
      `/api/txline/stream?feed=scores&fixtureId=${fixtureId}`,
    );

    stream.onopen = () => active && setStreamState("live");
    stream.onerror = () => active && setStreamState("reconnecting");
    stream.onmessage = (message) => {
      try {
        const event = normalizeTxlineScore(JSON.parse(message.data), "txline");
        if (!active || !event || event.fixtureId !== fixtureId || seen.has(event.id)) return;
        seen.add(event.id);
        setEvents((current) => [...current, event].slice(-50));
      } catch {
        // TxLINE heartbeats and non-JSON SSE messages are intentionally ignored.
      }
    };

    return () => {
      active = false;
      stream.close();
    };
  }, [enabled, fixtureId]);

  return { events, streamState };
}
