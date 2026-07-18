"use client";

import {
  CheckCircle,
  LinkSimple,
  ShieldCheck,
  SpinnerGap,
  Wallet,
  X,
} from "@phosphor-icons/react";
import type { CreateDefaultClientOptions } from "@solana/client";
import { getAddMemoInstruction } from "@solana-program/memo";
import {
  SolanaProvider,
  useBalance,
  useSendTransaction,
  useWalletConnection,
} from "@solana/react-hooks";
import { useEffect, useMemo, useState } from "react";
import {
  ACHIEVEMENT_CALL_TARGET,
  buildAchievementMemo,
  type VerifiedCallProof,
} from "@/lib/achievements";

type WalletAchievementProps = {
  fixtureId: number;
  calls: VerifiedCallProof[];
  onWalletStatusChange?: (connected: boolean) => void;
  onProofConfirmed?: (signature: string | null) => void;
};

type VerificationState = "idle" | "checking" | "verified" | "invalid" | "unavailable";

const solanaConfig: CreateDefaultClientOptions = {
  cluster: "devnet",
  rpc: "https://api.devnet.solana.com",
  websocket: "wss://api.devnet.solana.com",
  walletConnectors: "default",
};

function shortAddress(value: string) {
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function friendlyError(value: unknown) {
  const message = value instanceof Error ? value.message : String(value);
  if (/reject|declin|cancel/i.test(message)) return "Signature cancelled — nothing was sent.";
  if (/insufficient|balance|fund/i.test(message)) return "This wallet needs a small amount of devnet SOL for the network fee.";
  return "The achievement did not land. Check the wallet network and try again.";
}

function WalletAchievementPanel({
  fixtureId,
  calls,
  onWalletStatusChange,
  onProofConfirmed,
}: WalletAchievementProps) {
  const {
    connectors,
    connect,
    disconnect,
    connecting,
    currentConnector,
    error: connectionError,
    isReady,
    status: walletStatus,
    wallet,
  } = useWalletConnection();
  const address = wallet?.account.address;
  const addressString = address?.toString() ?? "";
  const balance = useBalance(address);
  const transaction = useSendTransaction();
  const [modalOpen, setModalOpen] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [verificationState, setVerificationState] = useState<VerificationState>("idle");

  const eligible = calls.length >= ACHIEVEMENT_CALL_TARGET;
  const signature = transaction.signature?.toString() ?? savedSignature;
  const explorerUrl = signature
    ? `https://explorer.solana.com/tx/${signature}?cluster=devnet`
    : null;
  const sessionXp = useMemo(
    () => calls.reduce((total, call) => total + call.xp, 0),
    [calls],
  );
  const solBalance = balance.lamports === null
    ? null
    : Number(balance.lamports) / 1_000_000_000;

  useEffect(() => {
    if (!addressString) {
      setSavedSignature(null);
      setVerificationState("idle");
      return;
    }
    setSavedSignature(window.localStorage.getItem(`plot-twist-proof:${fixtureId}:${addressString}`));
  }, [addressString, fixtureId]);

  useEffect(() => {
    if (!transaction.signature || !addressString) return;
    const nextSignature = transaction.signature.toString();
    window.localStorage.setItem(`plot-twist-proof:${fixtureId}:${addressString}`, nextSignature);
    setSavedSignature(nextSignature);
  }, [addressString, fixtureId, transaction.signature]);

  useEffect(() => {
    if (!signature || !addressString) {
      setVerificationState("idle");
      return;
    }
    let cancelled = false;

    async function verifyAchievement() {
      setVerificationState("checking");
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await fetch(
            `/api/solana/achievement/${signature}?wallet=${addressString}&fixtureId=${fixtureId}`,
            { cache: "no-store" },
          );
          const payload = await response.json() as { verified?: boolean };
          if (cancelled) return;
          if (response.ok && payload.verified) {
            setVerificationState("verified");
            return;
          }
          if (response.status !== 404) {
            setVerificationState(response.status >= 500 ? "unavailable" : "invalid");
            return;
          }
        } catch {
          if (attempt === 2 && !cancelled) setVerificationState("unavailable");
        }
        await new Promise((resolve) => window.setTimeout(resolve, 700));
      }
      if (!cancelled) setVerificationState("invalid");
    }

    void verifyAchievement();
    return () => { cancelled = true; };
  }, [addressString, fixtureId, signature]);

  useEffect(() => {
    onWalletStatusChange?.(walletStatus === "connected" && Boolean(addressString));
  }, [addressString, onWalletStatusChange, walletStatus]);

  useEffect(() => {
    onProofConfirmed?.(
      addressString && eligible && verificationState === "verified" ? signature ?? null : null,
    );
  }, [addressString, eligible, onProofConfirmed, signature, verificationState]);

  async function connectWallet(connectorId: string) {
    setClaimError(null);
    try {
      await connect(connectorId);
      setModalOpen(false);
    } catch (error) {
      setClaimError(friendlyError(error));
    }
  }

  async function stampProof() {
    if (!eligible || walletStatus !== "connected" || !addressString) return;
    setClaimError(null);
    setVerificationState("idle");
    setSavedSignature(null);
    window.localStorage.removeItem(`plot-twist-proof:${fixtureId}:${addressString}`);
    transaction.reset();
    try {
      const memo = buildAchievementMemo({
        fixtureId,
        wallet: addressString,
        calls: calls.slice(0, ACHIEVEMENT_CALL_TARGET),
        issuedAt: new Date().toISOString(),
      });
      const instruction = getAddMemoInstruction({ memo });
      await transaction.send(
        { instructions: [instruction], commitment: "confirmed" },
        { commitment: "confirmed", skipPreflight: false },
      );
    } catch (error) {
      setClaimError(friendlyError(error));
    }
  }

  return (
    <>
      <section className={`proofStrip shell ${eligible ? "unlocked" : ""}`} id="solana-proof">
        <div className="proofIdentity">
          <span className="proofIcon"><ShieldCheck weight="fill" /></span>
          <div><small>WALLET-SIGNED FAN ACHIEVEMENT · SOLANA DEVNET</small><h3>Plot Twister</h3></div>
        </div>

        <div className="proofProgress">
          <div><span>{Math.min(calls.length, ACHIEVEMENT_CALL_TARGET)}/{ACHIEVEMENT_CALL_TARGET} verified calls</span><b>+{sessionXp} session XP</b></div>
          <div className="proofMeter"><i style={{ width: `${Math.min(100, calls.length * 50)}%` }} /></div>
        </div>

        <div className="proofWallet">
          {walletStatus === "connected" && addressString ? (
            <div className="walletIdentity">
              <span><Wallet weight="fill" /> {shortAddress(addressString)}</span>
              <small>{solBalance === null ? "Balance…" : `${solBalance.toFixed(3)} SOL`} · {currentConnector?.name ?? "Wallet"}</small>
              <button onClick={() => void disconnect()}>Disconnect</button>
            </div>
          ) : null}

          {eligible && explorerUrl && verificationState === "verified" ? (
            <a className="proofAction verified" href={explorerUrl} target="_blank" rel="noreferrer">
              <CheckCircle weight="fill" /> Achievement verified <LinkSimple />
            </a>
          ) : eligible && explorerUrl && verificationState === "checking" ? (
            <a className="proofAction verified" href={explorerUrl} target="_blank" rel="noreferrer">
              <SpinnerGap className="spinIcon" /> Verifying on Solana… <LinkSimple />
            </a>
          ) : walletStatus !== "connected" ? (
            <button className="proofAction" onClick={() => setModalOpen(true)}>
              <Wallet weight="fill" /> Connect wallet
            </button>
          ) : (
            <button className="proofAction" disabled={!eligible || transaction.isSending} onClick={() => void stampProof()}>
              {transaction.isSending ? <SpinnerGap className="spinIcon" /> : <ShieldCheck weight="fill" />}
              {transaction.isSending ? "Approve in wallet…" : eligible ? "Stamp achievement on Solana" : "Win 2 calls to unlock"}
            </button>
          )}
        </div>

        {(claimError || transaction.error || connectionError || verificationState === "invalid" || verificationState === "unavailable") ? (
          <p className="proofError" role="alert">{
            claimError
              ?? (transaction.error || connectionError ? friendlyError(transaction.error ?? connectionError) : null)
              ?? (verificationState === "invalid"
                ? "The saved achievement is not a valid PLOT TWIST Memo signed by this wallet. Stamp a new one."
                : "Solana verification is temporarily unavailable. The saved signature was not trusted.")
          }</p>
        ) : null}
      </section>

      {modalOpen ? (
        <div className="walletModalBackdrop" role="presentation" onMouseDown={() => setModalOpen(false)}>
          <div className="walletModal" role="dialog" aria-modal="true" aria-label="Connect a Solana wallet" onMouseDown={(event) => event.stopPropagation()}>
            <div className="walletModalHead">
              <div><small>SOLANA DEVNET</small><h3>Connect your fan identity</h3></div>
              <button aria-label="Close wallet dialog" onClick={() => setModalOpen(false)}><X /></button>
            </div>
            <p>Your wallet signs the achievement transaction. PLOT TWIST never receives your private key.</p>
            <div className="walletOptions">
              {!isReady ? <span><SpinnerGap className="spinIcon" /> Scanning for wallets…</span> : connectors.length ? connectors.map((connector) => (
                <button key={connector.id} disabled={connecting} onClick={() => void connectWallet(connector.id)}>
                  <Wallet weight="fill" /><b>{connector.name}</b><small>{connector.ready === false ? "Open or install" : "Wallet Standard"}</small>
                </button>
              )) : <span>No Wallet Standard wallet detected. Install or open one, then refresh this page.</span>}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function WalletAchievement(props: WalletAchievementProps) {
  return (
    <SolanaProvider
      config={solanaConfig}
      walletPersistence={{ autoConnect: true, storageKey: "plot-twist-wallet" }}
    >
      <WalletAchievementPanel {...props} />
    </SolanaProvider>
  );
}
