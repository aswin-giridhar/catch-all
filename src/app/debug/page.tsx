"use client";

import { useState } from "react";
import { useMagic } from "@/components/providers/MagicProvider";
import { useUniversalAccount } from "@/components/providers/UniversalAccountProvider";
import { ARBITRUM_CHAIN_ID } from "@/lib/constants";

/**
 * Diagnostic rig for the chain-abstraction spine.
 *
 * Each stage is shown separately so a failure points at one link rather than
 * "it doesn't work". The product UI replaces this once the concept is chosen.
 */
export default function Home() {
  const { address, isReady, isAuthenticating, loginWithEmail, logout } = useMagic();
  const {
    accountInfo,
    primaryAssets,
    isDelegated,
    isLoading,
    ensureDelegated,
    refreshAssets,
    convertOntoChain,
    resolveTxHash,
  } = useUniversalAccount();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [crossChainTx, setCrossChainTx] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Surfacing the real error text matters — SDK failures here are rarely self-evident. */
  async function run(action: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  const totalUsd = primaryAssets?.totalAmountInUSD;

  return (
    <main className="mx-auto w-full max-w-2xl p-8 font-mono text-sm">
      <h1 className="mb-6 text-lg font-bold">Chain-abstraction spine — diagnostics</h1>

      <Stage label="1. Magic SDK ready" ok={isReady} value={isReady ? "yes" : "initialising…"} />

      {!address ? (
        <form
          className="my-6 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => loginWithEmail(email));
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 rounded border border-neutral-400 px-3 py-2"
          />
          <button
            type="submit"
            disabled={!isReady || isAuthenticating}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-40"
          >
            {isAuthenticating ? "Check your email…" : "Sign in"}
          </button>
        </form>
      ) : (
        <div className="my-6 space-y-2">
          <Stage label="2. EOA (from Magic)" ok value={address} />
          <Stage
            label="3. Universal Account address"
            ok={Boolean(accountInfo?.evmAccount)}
            value={accountInfo?.evmAccount || (isLoading ? "loading…" : "—")}
          />
          <Stage
            // In 7702 mode the EOA *is* the Universal Account. Matching addresses
            // is the clearest possible proof the mode is actually active.
            label="4. Same address? (proves 7702 mode)"
            ok={Boolean(
              accountInfo?.evmAccount &&
                accountInfo.evmAccount.toLowerCase() === address.toLowerCase(),
            )}
            value={
              accountInfo?.evmAccount
                ? accountInfo.evmAccount.toLowerCase() === address.toLowerCase()
                  ? "YES — EOA upgraded in place"
                  : "NO — separate smart account (7702 not active)"
                : "—"
            }
          />
          <Stage
            label={`5. Delegated on Arbitrum (${ARBITRUM_CHAIN_ID})`}
            ok={isDelegated}
            value={isDelegated ? "yes" : "not yet"}
          />
          <Stage
            label="6. Unified balance"
            ok={totalUsd !== undefined}
            value={totalUsd !== undefined ? `$${totalUsd}` : isLoading ? "loading…" : "—"}
          />

          <div className="flex flex-wrap gap-2 pt-4">
            <button
              onClick={() => run(ensureDelegated)}
              disabled={busy || isDelegated}
              className="rounded border border-black px-3 py-2 disabled:opacity-40"
            >
              Delegate on Arbitrum
            </button>
            <button
              onClick={() =>
                run(async () => {
                  // A genuine cross-chain operation: value is sourced from whatever
                  // this account holds, on whichever chain, and lands on Base.
                  const result = await convertOntoChain(8453, "usdc", "1");
                  const hash = await resolveTxHash(result.transactionId);
                  setCrossChainTx(hash);
                  await refreshAssets();
                })
              }
              disabled={busy}
              className="rounded border border-black px-3 py-2 disabled:opacity-40"
            >
              Move $1 to Base (cross-chain)
            </button>
            <button
              onClick={() => run(refreshAssets)}
              disabled={busy}
              className="rounded border border-black px-3 py-2 disabled:opacity-40"
            >
              Refresh balance
            </button>
            <button onClick={() => run(logout)} className="rounded border px-3 py-2">
              Sign out
            </button>
          </div>
        </div>
      )}

      {crossChainTx && (
        <p className="mt-4 rounded bg-green-50 p-3 text-green-800">
          Cross-chain transfer complete:{" "}
          <a
            className="underline"
            href={`https://arbiscan.io/tx/${crossChainTx}`}
            target="_blank"
            rel="noreferrer"
          >
            {crossChainTx.slice(0, 18)}…
          </a>
        </p>
      )}

      {error && (
        <pre className="mt-4 whitespace-pre-wrap rounded bg-red-50 p-3 text-red-800">{error}</pre>
      )}

      {primaryAssets && (
        <details className="mt-6">
          <summary className="cursor-pointer">Raw primary assets</summary>
          <pre className="mt-2 overflow-x-auto rounded bg-neutral-100 p-3 text-xs">
            {JSON.stringify(primaryAssets, null, 2)}
          </pre>
        </details>
      )}
    </main>
  );
}

function Stage({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={ok ? "text-green-600" : "text-neutral-400"}>{ok ? "✓" : "○"}</span>
      <span className="text-neutral-600">{label}:</span>
      <span className="break-all font-semibold">{value}</span>
    </div>
  );
}
