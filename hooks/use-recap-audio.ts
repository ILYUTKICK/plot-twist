"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecapVoiceState = "idle" | "loading" | "speaking" | "fallback" | "unsupported";

export function useRecapAudio() {
  const [voiceState, setVoiceState] = useState<RecapVoiceState>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const releaseAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.onplay = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    releaseAudio();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setVoiceState("idle");
  }, [releaseAudio]);

  const playBrowserFallback = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) {
      setVoiceState("unsupported");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1.03;
    utterance.onstart = () => setVoiceState("fallback");
    utterance.onend = () => setVoiceState("idle");
    utterance.onerror = () => setVoiceState("idle");
    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback(async (text: string) => {
    stop();
    const controller = new AbortController();
    controllerRef.current = controller;
    setVoiceState("loading");
    try {
      const response = await fetch("/api/voice-recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Premium voice unavailable");
      const blob = await response.blob();
      if (controller.signal.aborted) return;

      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audioUrlRef.current = audioUrl;
      audioRef.current = audio;
      audio.onplay = () => setVoiceState("speaking");
      audio.onended = () => {
        releaseAudio();
        setVoiceState("idle");
      };
      audio.onerror = () => {
        releaseAudio();
        playBrowserFallback(text);
      };
      await audio.play();
    } catch {
      if (!controller.signal.aborted) playBrowserFallback(text);
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [playBrowserFallback, releaseAudio, stop]);

  useEffect(() => stop, [stop]);

  return { voiceState, speak, stop };
}
