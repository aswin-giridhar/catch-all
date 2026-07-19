"use client";

import { useState } from "react";
import { FlapBoard, FlapCycler } from "@/components/FlapBoard";
import { useMagic } from "@/components/providers/MagicProvider";

/** What people might send. The board cycles these, then settles on what always arrives. */
const INCOMING = ["USDT · BNB", "ETH · BASE", "SOL · SOLANA", "USDC · ETH", "BNB · BNB"];
const ARRIVES = "USDC · ARBITRUM";
const BOARD_WIDTH = 15;

export function Landing() {
  const { loginWithEmail, isReady, isAuthenticating } = useMagic();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await loginWithEmail(email);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
      <p className="font-board text-[0.65rem] uppercase tracking-[0.28em] text-brass">
        Catch-all
      </p>

      <h1 className="mt-5 max-w-3xl font-display text-5xl font-extrabold leading-[1.02] tracking-tight text-ink sm:text-7xl">
        An address that
        <br />
        can&rsquo;t be paid wrong.
      </h1>

      <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
        Share one link. People send whatever they&rsquo;re holding, from whichever chain
        they&rsquo;re on. It always reaches you as USDC on Arbitrum.
      </p>

      {/* The thesis, shown rather than claimed: many inputs, one settled output. */}
      <div className="mt-12 flex flex-col gap-6 rounded-lg border border-ink/10 bg-paper-deep/60 p-7 sm:flex-row sm:items-center sm:gap-10">
        <div>
          <p className="font-board text-[0.6rem] uppercase tracking-[0.24em] text-brass">
            They send
          </p>
          <FlapCycler
            options={INCOMING}
            resolvesTo={INCOMING[0]}
            width={BOARD_WIDTH}
            className="mt-3"
          />
        </div>

        {/* Points across on wide screens, down once the boards stack. */}
        <div aria-hidden className="font-display text-3xl leading-none text-brass">
          <span className="hidden sm:inline">→</span>
          <span className="sm:hidden">↓</span>
        </div>

        <div>
          <p className="font-board text-[0.6rem] uppercase tracking-[0.24em] text-brass">
            You receive
          </p>
          <FlapBoard value={ARRIVES} width={BOARD_WIDTH} className="mt-3" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-12 max-w-md">
        <label htmlFor="email" className="font-board text-[0.6rem] uppercase tracking-[0.24em] text-brass">
          Get your link
        </label>
        <div className="mt-3 flex gap-2">
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 rounded-md border border-ink/20 bg-paper px-4 py-3 text-ink outline-none placeholder:text-ink/35 focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-amber"
          />
          <button
            type="submit"
            disabled={!isReady || isAuthenticating}
            className="rounded-md bg-ink px-6 py-3 font-display font-bold text-paper transition-colors hover:bg-ink-soft focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:opacity-40"
          >
            {isAuthenticating ? "Check your email" : "Continue"}
          </button>
        </div>
        <p className="mt-3 text-sm text-ink-soft">
          No wallet to install. No seed phrase to write down.
        </p>
        {error && <p className="mt-3 text-sm text-rust">{error}</p>}
      </form>
    </main>
  );
}
