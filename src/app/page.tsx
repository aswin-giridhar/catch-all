"use client";

import { Home } from "@/components/Home";
import { Landing } from "@/components/Landing";
import { useMagic } from "@/components/providers/MagicProvider";

export default function Page() {
  const { address, isReady } = useMagic();

  // Hold the frame until the session probe finishes, so a returning user doesn't
  // see the landing page flash before their own balance appears.
  if (!isReady) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="font-board text-[0.65rem] uppercase tracking-[0.28em] text-brass">
          Catch-all
        </p>
      </main>
    );
  }

  return address ? <Home /> : <Landing />;
}
