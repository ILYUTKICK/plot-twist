"use client";

import {
  ArrowClockwise,
  Check,
  CheckCircle,
  Lightning,
  Play,
  X,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

type ServiceCheck = {
  state: "ready" | "fallback" | "error";
  latencyMs: number;
  detail: string;
};

type Readiness = {
  ready: boolean;
  checks: Record<"txline" | "ollama" | "solana", ServiceCheck>;
};

export type JudgeAction = {
  label: string;
  detail: string;
  onClick?: () => void;
  disabled?: boolean;
};

type JudgeModeProps = {
  open: boolean;
  onClose: () => void;
  onStart: () => void;
  action: JudgeAction;
  verifiedCallCount: number;
  completed: boolean;
};

const serviceLabels = {
  txline: "TxLINE",
  ollama: "Ollama",
  solana: "Solana",
};

export function JudgeMode({
  open,
  onClose,
  onStart,
  action,
  verifiedCallCount,
  completed,
}: JudgeModeProps) {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [checking, setChecking] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const response = await fetch("/api/demo-readiness", { cache: "no-store" });
      if (!response.ok) throw new Error("Preflight failed");
      setReadiness(await response.json() as Readiness);
    } catch {
      const unavailable = { state: "error", latencyMs: 0, detail: "Unavailable" } as const;
      setReadiness({
        ready: false,
        checks: { txline: unavailable, ollama: unavailable, solana: unavailable },
      });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (open && !readiness && !checking) void refresh();
  }, [checking, open, readiness, refresh]);

  useEffect(() => {
    if (!startedAt || completed) return;
    const update = () => setElapsed(Math.min(99, Math.floor((Date.now() - startedAt) / 1_000)));
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [completed, startedAt]);

  function startPitch() {
    onStart();
    setElapsed(0);
    setStartedAt(Date.now());
  }

  if (!open) return null;

  const secondsLeft = Math.max(0, 60 - elapsed);
  const progress = completed ? 100 : Math.min(92, 12 + verifiedCallCount * 36);

  return (
    <aside className="judgePanel" aria-label="Judge demo mode">
      <div className="judgeHead">
        <div><small>LIVE DEMO COPILOT</small><h2>60-sec Judge Mode</h2></div>
        <button onClick={onClose} aria-label="Close Judge Mode"><X /></button>
      </div>

      <div className={`judgeTimer ${startedAt && secondsLeft <= 10 ? "urgent" : ""}`}>
        <strong>{startedAt ? String(secondsLeft).padStart(2, "0") : "60"}</strong>
        <span>SECONDS<br />TO THE FINISH</span>
      </div>

      <div className="judgeReadiness">
        <div className="judgeSectionLabel">
          <span>DEMO PREFLIGHT</span>
          <button onClick={() => void refresh()} disabled={checking} aria-label="Refresh service checks">
            <ArrowClockwise className={checking ? "spinIcon" : ""} />
          </button>
        </div>
        <div className="judgeServices">
          {(Object.keys(serviceLabels) as Array<keyof typeof serviceLabels>).map((key) => {
            const check = readiness?.checks[key];
            return (
              <div key={key} className={check?.state ?? "checking"}>
                <i>{check?.state === "ready" || check?.state === "fallback" ? <Check /> : null}</i>
                <span><b>{serviceLabels[key]}</b><small>{check ? `${check.detail} · ${check.latencyMs}ms` : "Checking…"}</small></span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="judgeProgress"><i style={{ width: `${progress}%` }} /></div>

      <div className={`judgeNext ${completed ? "complete" : ""}`}>
        <span>{completed ? <CheckCircle weight="fill" /> : <Lightning weight="fill" />}</span>
        <div><small>{completed ? "DEMO COMPLETE" : "SAY THIS, THEN CLICK"}</small><h3>{action.label}</h3><p>{action.detail}</p></div>
      </div>

      {!startedAt ? (
        <button className="judgePrimary" onClick={startPitch} disabled={checking}>
          <Play weight="fill" /> Start clean pitch
        </button>
      ) : action.onClick && !completed ? (
        <button className="judgePrimary" onClick={action.onClick} disabled={action.disabled}>
          <Lightning weight="fill" /> {action.label}
        </button>
      ) : null}

      <p className="judgeFoot">AI narrates. TxLINE verifies. Solana remembers.</p>
    </aside>
  );
}
