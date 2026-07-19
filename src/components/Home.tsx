"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { FlapBoard } from "@/components/FlapBoard";
import { useMagic } from "@/components/providers/MagicProvider";
import { useUniversalAccount } from "@/components/providers/UniversalAccountProvider";

export function Home() {
  const { address, logout } = useMagic();
  const { primaryAssets, isLoading, refreshAssets } = useUniversalAccount();
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");

  // Remembered locally so the link keeps showing a person's name across visits.
  // There is no server to store it on, and it isn't worth one.
  useEffect(() => {
    setName(localStorage.getItem("catchall:name") ?? "");
  }, []);

  function updateName(value: string) {
    setName(value);
    localStorage.setItem("catchall:name", value);
  }

  const link = address
    ? `${window.location.origin}/r/${address}${name.trim() ? `?n=${encodeURIComponent(name.trim())}` : ""}`
    : "";

  useEffect(() => {
    if (!link) return;
    QRCode.toDataURL(link, {
      margin: 1,
      width: 320,
      color: { dark: "#0D2321", light: "#F2EFE6" },
    })
      .then(setQr)
      .catch(() => setQr(null));
  }, [link]);

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const balance = primaryAssets?.totalAmountInUSD ?? 0;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
      <header className="flex items-center justify-between">
        <p className="font-board text-[0.65rem] uppercase tracking-[0.28em] text-brass">
          Catch-all
        </p>
        <button
          onClick={logout}
          className="text-sm text-ink-soft underline underline-offset-4 hover:text-ink"
        >
          Sign out
        </button>
      </header>

      <section className="mt-12">
        <p className="font-board text-[0.6rem] uppercase tracking-[0.24em] text-brass">
          Your balance
        </p>
        <div className="mt-4 flex items-end gap-4">
          <FlapBoard value={`$${balance.toFixed(2)}`} size="lg" width={8} />
        </div>
        <p className="mt-3 text-sm text-ink-soft">
          Held as USDC on Arbitrum.{" "}
          <button
            onClick={() => refreshAssets()}
            className="underline underline-offset-4 hover:text-ink"
          >
            {isLoading ? "Checking…" : "Refresh"}
          </button>
        </p>
      </section>

      <section className="mt-14 rounded-lg border border-ink/10 bg-paper-deep/60 p-7">
        <h2 className="font-display text-2xl font-bold text-ink">Your link</h2>
        <p className="mt-2 max-w-md text-ink-soft">
          Send this to anyone. Whatever they hold, wherever they hold it, it reaches you
          as USDC on Arbitrum.
        </p>

        <label className="mt-6 block">
          <span className="font-board text-[0.6rem] uppercase tracking-[0.24em] text-brass">
            Your name
          </span>
          <input
            value={name}
            onChange={(e) => updateName(e.target.value)}
            placeholder="So people know who they're paying"
            className="mt-2 w-full rounded-md border border-ink/20 bg-paper px-4 py-2.5 outline-none placeholder:text-ink/30 focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-amber"
          />
        </label>

        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
          {qr && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qr}
              alt="QR code for your payment link"
              className="h-36 w-36 shrink-0 rounded-md border border-ink/10"
            />
          )}

          <div className="min-w-0 flex-1">
            <code className="block truncate rounded-md border border-ink/15 bg-paper px-4 py-3 font-board text-xs text-ink-soft">
              {link}
            </code>
            <button
              onClick={copyLink}
              className="mt-3 rounded-md bg-ink px-5 py-2.5 font-display font-bold text-paper transition-colors hover:bg-ink-soft focus-visible:ring-2 focus-visible:ring-amber"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-dashed border-ink/20 p-7">
        <h2 className="font-display text-xl font-bold text-ink">Charge for something</h2>
        <p className="mt-2 max-w-md text-ink-soft">
          Put a price on a link — a guide, a file, an answer. People pay from any chain and
          get it straight away.
        </p>
        <a
          href="/new"
          className="mt-5 inline-block rounded-md border border-ink px-5 py-2.5 font-display font-bold text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          Create a paid link
        </a>
      </section>
    </main>
  );
}
