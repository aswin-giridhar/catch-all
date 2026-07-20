"use client";

import { useRef, useState } from "react";
import { FlapBoard } from "@/components/FlapBoard";
import { useMagic } from "@/components/providers/MagicProvider";
import { useUniversalAccount } from "@/components/providers/UniversalAccountProvider";
import { ARBISCAN_TX_URL, ARBITRUM_CHAIN_ID, USDC_ARBITRUM } from "@/lib/constants";

type Stage = "amount" | "sourcing" | "review" | "sending" | "done";

type BuiltTransaction = {
  rootHash: string;
  userOps?: Array<{ expiredAt?: number }>;
  /** Fees live on feeQuotes[].fees.totals — there is no top-level `fees` field. */
  feeQuotes?: Array<{ fees?: { totals?: { feeTokenAmountInUSD?: string } } }>;
};

export function PayFlow({
  recipient,
  recipientName,
  price,
  title,
  unlocks,
}: {
  recipient: string;
  /** Display name, so the payer sees a person instead of a hex string. */
  recipientName?: string;
  /** Fixed price for a paid link; omitted for an open "send me anything" link. */
  price?: string;
  title?: string;
  /** Revealed once payment succeeds, for paid links. */
  unlocks?: string;
}) {
  const { address, loginWithEmail, isReady, isAuthenticating } = useMagic();
  const {
    universalAccount,
    primaryAssets,
    ensureDelegated,
    signAndSend,
    resolveTxHash,
    heldOnChain,
    convertOntoChain,
    refreshAssets,
  } = useUniversalAccount();

  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState(price ?? "");
  const [stage, setStage] = useState<Stage>("amount");
  const [tx, setTx] = useState<BuiltTransaction | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);

  const short = `${recipient.slice(0, 6)}…${recipient.slice(-4)}`;
  const payee = recipientName?.trim() || short;
  const balance = primaryAssets?.totalAmountInUSD ?? 0;

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await loginWithEmail(email);
    } catch (e) {
      setError(message(e));
    }
  }

  /** Build the transaction so the payer sees the real cost before signing anything. */
  async function handleReview() {
    if (!universalAccount) return;
    setError(null);
    setStage("review");
    try {
      // Delegation must exist on the payer's funded chains before UA can route.
      await ensureDelegated();

      // `createTransferTransaction` is same-chain only: it moves a token already held
      // on the destination chain. If the payer's money lives elsewhere, source it
      // across first with a convert — that is the cross-chain operation.
      const wanted = Number(amount);
      if (heldOnChain("usdc", ARBITRUM_CHAIN_ID) < wanted) {
        setStage("sourcing");
        await convertOntoChain(ARBITRUM_CHAIN_ID, "usdc", amount);

        // Bridging isn't instant. Wait for the balance to actually land rather than
        // building a transfer against a balance that hasn't arrived.
        for (let attempt = 0; attempt < 30; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await refreshAssets();
          if (heldOnChain("usdc", ARBITRUM_CHAIN_ID) >= wanted) break;
        }
        setStage("review");
      }

      const built = (await universalAccount.createTransferTransaction({
        token: { chainId: ARBITRUM_CHAIN_ID, address: USDC_ARBITRUM },
        amount,
        receiver: recipient,
      })) as BuiltTransaction;
      setTx(built);
    } catch (e) {
      setError(message(e));
      setStage("amount");
    }
  }

  async function handlePay() {
    if (!tx || sending.current) return;
    // A ref guard, not the disabled prop: `disabled` only applies after React
    // commits, so two fast clicks can both enter this function and pay twice.
    sending.current = true;
    setError(null);
    setStage("sending");
    try {
      const result = await signAndSend(tx as never);
      // Show the receipt immediately — the money has moved. The explorer link fills
      // in a moment later, once the bundle lands and a real hash exists.
      setStage("done");
      resolveTxHash(result.transactionId).then(setTxHash);
    } catch (e) {
      setError(message(e));
      // Discard the transaction rather than offering "try again" on the same one.
      // If it failed *after* broadcasting, re-sending would pay twice; forcing a
      // rebuild re-quotes against current balances instead.
      setTx(null);
      setStage("amount");
    } finally {
      sending.current = false;
    }
  }

  const fee = tx?.feeQuotes?.[0]?.fees?.totals?.feeTokenAmountInUSD;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-14">
      <p className="font-board text-[0.65rem] uppercase tracking-[0.28em] text-brass">
        Catch-all
      </p>

      {stage === "done" ? (
        <Receipt amount={amount} recipient={payee} txHash={txHash} unlocks={unlocks} />
      ) : (
        <>
          <h1 className="mt-6 font-display text-4xl font-extrabold leading-tight text-ink">
            {title ?? `Pay ${payee}`}
          </h1>
          {price && (
            <p className="mt-4 font-display text-3xl font-bold text-ink">${price}</p>
          )}

          <p className="mt-3 text-ink-soft">
            Pay with anything you hold, on any chain. It arrives as USDC on Arbitrum.
          </p>

          <div className="mt-8 rounded-lg border border-ink/10 bg-paper-deep/60 p-5">
            <p className="font-board text-[0.6rem] uppercase tracking-[0.24em] text-brass">
              Arrives as
            </p>
            <FlapBoard value="USDC · ARBITRUM" width={15} size="sm" className="mt-3" />
          </div>

          {!address ? (
            <form onSubmit={handleLogin} className="mt-10">
              <label
                htmlFor="email"
                className="font-board text-[0.6rem] uppercase tracking-[0.24em] text-brass"
              >
                Your email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-3 w-full rounded-md border border-ink/20 bg-paper px-4 py-3 outline-none placeholder:text-ink/35 focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-amber"
              />
              <button
                type="submit"
                disabled={!isReady || isAuthenticating}
                className="mt-4 w-full rounded-md bg-ink px-6 py-3 font-display font-bold text-paper hover:bg-ink-soft focus-visible:ring-2 focus-visible:ring-amber disabled:opacity-40"
              >
                {isAuthenticating ? "Check your email" : "Continue"}
              </button>
              <p className="mt-3 text-sm text-ink-soft">
                We&rsquo;ll set up an account for you. Nothing to install.
              </p>
            </form>
          ) : (
            <div className="mt-10">
              <label
                htmlFor="amount"
                className="font-board text-[0.6rem] uppercase tracking-[0.24em] text-brass"
              >
                Amount
              </label>
              <div className="mt-3 flex items-center gap-2 rounded-md border border-ink/20 bg-paper px-4 focus-within:border-ink focus-within:ring-2 focus-within:ring-amber">
                <span className="font-display text-2xl text-ink-soft">$</span>
                <input
                  id="amount"
                  inputMode="decimal"
                  value={amount}
                  readOnly={Boolean(price)}
                  onChange={(e) => {
                    setAmount(e.target.value.replace(/[^0-9.]/g, ""));
                    // Any edit invalidates the quote. Without this the screen can
                    // read "Send $50" while sending a transaction built for $5.
                    if (tx) {
                      setTx(null);
                      setStage("amount");
                    }
                  }}
                  placeholder="5.00"
                  className="w-full bg-transparent py-3 font-board text-xl outline-none placeholder:text-ink/30"
                />
              </div>
              <p className="mt-2 text-sm text-ink-soft">
                You have ${balance.toFixed(2)} available across all your chains.
              </p>

              {stage === "review" && tx && (
                <div className="mt-6 rounded-md border border-ink/15 bg-paper-deep/60 p-5">
                  <Row label="They receive" value={`$${amount} USDC on Arbitrum`} />
                  <Row
                    label="Network fee"
                    value={fee !== undefined ? `$${Number(fee).toFixed(4)}` : "—"}
                  />
                  <p className="mt-3 text-sm text-ink-soft">
                    Routed from whatever you&rsquo;re holding. No bridge, no gas token needed.
                  </p>
                </div>
              )}

              <button
                onClick={stage === "review" && tx ? handlePay : handleReview}
                disabled={!amount || Number(amount) <= 0 || stage === "sending" || stage === "sourcing"}
                className="mt-6 w-full rounded-md bg-ink px-6 py-3.5 font-display font-bold text-paper hover:bg-ink-soft focus-visible:ring-2 focus-visible:ring-amber disabled:opacity-40"
              >
                {stage === "sourcing"
                  ? "Bringing your money across…"
                  : stage === "sending"
                  ? "Sending…"
                  : stage === "review" && tx
                    ? `Send $${amount}`
                    : "Review payment"}
              </button>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-md border border-rust/30 bg-rust/5 p-3 text-sm text-rust">
              {error}
            </p>
          )}
        </>
      )}
    </main>
  );
}

function Receipt({
  amount,
  recipient,
  txHash,
  unlocks,
}: {
  amount: string;
  recipient: string;
  txHash: string | null;
  unlocks?: string;
}) {
  return (
    <div className="mt-8">
      <h1 className="font-display text-4xl font-extrabold leading-tight text-ink">
        {unlocks ? "Unlocked." : "Sent."}
      </h1>
      <p className="mt-3 text-ink-soft">
        {recipient} received it as USDC on Arbitrum — whatever you paid with.
      </p>

      {unlocks && (
        <div className="mt-6 rounded-lg border border-mint/40 bg-mint/10 p-5">
          <p className="font-board text-[0.6rem] uppercase tracking-[0.24em] text-brass">
            Here it is
          </p>
          <p className="mt-3 whitespace-pre-wrap break-words text-ink">{unlocks}</p>
        </div>
      )}

      <div className="receipt-edge mt-8 rounded-md bg-paper-deep/70 p-6">
        <p className="font-board text-[0.6rem] uppercase tracking-[0.24em] text-brass">
          Arrived as
        </p>
        <FlapBoard value="USDC · ARBITRUM" width={15} className="mt-3" />

        <div className="mt-6 border-t border-ink/10 pt-4">
          <Row label="Amount" value={`$${amount}`} />
          <Row label="To" value={recipient} />
        </div>
      </div>

      {txHash ? (
        <a
          href={ARBISCAN_TX_URL(txHash)}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-block text-sm text-ink underline underline-offset-4 hover:text-brass"
        >
          View on Arbiscan
        </a>
      ) : (
        <p className="mt-6 text-sm text-ink-soft">Confirming on Arbitrum…</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="font-board text-sm text-ink">{value}</span>
    </div>
  );
}

function message(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  // -32653. Genuinely ambiguous: it means an empty account, but other teams have
  // also hit it on cross-chain routes *with* funds present, which Particle is
  // investigating. Naming both possibilities beats asserting the wrong one.
  if (raw.includes("Insufficient primary token balance")) {
    return "Not enough balance for that amount plus the network fee — or the cross-chain route is temporarily unavailable. Try a smaller amount.";
  }
  if (raw.includes("System maintenance")) {
    return "Particle's routing is under maintenance right now. Try again shortly.";
  }
  return raw;
}
