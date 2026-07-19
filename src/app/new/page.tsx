"use client";

import Link from "next/link";
import { useState } from "react";
import { useMagic } from "@/components/providers/MagicProvider";
import { buildPaidLink } from "@/lib/paidLink";

export default function NewPaidLink() {
  const { address, isReady } = useMagic();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [payload, setPayload] = useState("");
  const [copied, setCopied] = useState(false);

  const ready = Boolean(title.trim() && Number(price) > 0 && payload.trim() && address);
  const link = ready ? buildPaidLink(window.location.origin, address!, { title, price, payload }) : "";

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!isReady) return null;

  if (!address) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-14">
        <p className="text-ink-soft">
          <Link href="/" className="underline underline-offset-4">
            Sign in
          </Link>{" "}
          to create a paid link.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-14">
      <Link
        href="/"
        className="font-board text-[0.65rem] uppercase tracking-[0.28em] text-brass hover:text-ink"
      >
        ← Catch-all
      </Link>

      <h1 className="mt-6 font-display text-4xl font-extrabold leading-tight text-ink">
        Charge for something
      </h1>
      <p className="mt-3 text-ink-soft">
        People pay from any chain and get it straight away. You receive USDC on Arbitrum.
      </p>

      <div className="mt-10 space-y-6">
        <Field label="What are you selling?">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My packing checklist"
            className="w-full rounded-md border border-ink/20 bg-paper px-4 py-3 outline-none placeholder:text-ink/30 focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-amber"
          />
        </Field>

        <Field label="Price">
          <div className="flex items-center gap-2 rounded-md border border-ink/20 bg-paper px-4 focus-within:border-ink focus-within:ring-2 focus-within:ring-amber">
            <span className="font-display text-xl text-ink-soft">$</span>
            <input
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="2.00"
              className="w-full bg-transparent py-3 font-board outline-none placeholder:text-ink/30"
            />
          </div>
        </Field>

        <Field label="What they get after paying">
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            rows={4}
            placeholder="A link, a code, or a message."
            className="w-full resize-none rounded-md border border-ink/20 bg-paper px-4 py-3 outline-none placeholder:text-ink/30 focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-amber"
          />
        </Field>
      </div>

      {ready ? (
        <div className="mt-8 rounded-lg border border-ink/10 bg-paper-deep/60 p-5">
          <p className="font-board text-[0.6rem] uppercase tracking-[0.24em] text-brass">
            Your link
          </p>
          <code className="mt-3 block truncate rounded-md border border-ink/15 bg-paper px-3 py-2.5 font-board text-xs text-ink-soft">
            {link}
          </code>
          <button
            onClick={copyLink}
            className="mt-3 w-full rounded-md bg-ink px-5 py-2.5 font-display font-bold text-paper hover:bg-ink-soft focus-visible:ring-2 focus-visible:ring-amber"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      ) : (
        <p className="mt-8 text-sm text-ink-soft">
          Fill in all three and your link appears here.
        </p>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-board text-[0.6rem] uppercase tracking-[0.24em] text-brass">
        {label}
      </span>
      <div className="mt-3">{children}</div>
    </label>
  );
}
