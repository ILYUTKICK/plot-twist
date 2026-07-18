"use client";

import { useEffect, useState } from "react";
import { findBestMatchWinnerMarket, type MatchWinnerMarket } from "@/lib/odds";

type StreamState = "connecting" | "live" | "reconnecting" | "offline";

export function useTxlineOdds(fixtureId: number) {
  const [market, setMarket] = useState<MatchWinnerMarket | null>(null);
  const [streamState, setStreamState] = useState<StreamState>("connecting");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetch(`/api/txline/odds/${fixtureId}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        const nextMarket = findBestMatchWinnerMarket(payload, fixtureId);
        if (active && nextMarket) setMarket(nextMarket);
      })
      .catch(() => undefined);

    const stream = new EventSource("/api/txline/stream?feed=odds");
    stream.onopen = () => active && setStreamState("live");
    stream.onerror = () => active && setStreamState("reconnecting");
    stream.onmessage = (message) => {
      try {
        const nextMarket = findBestMatchWinnerMarket(JSON.parse(message.data), fixtureId);
        if (active && nextMarket) setMarket(nextMarket);
      } catch {
        // TxLINE heartbeats and non-JSON messages do not change market state.
      }
    };

    return () => {
      active = false;
      controller.abort();
      stream.close();
      setStreamState("offline");
    };
  }, [fixtureId]);

  return { market, streamState };
}
