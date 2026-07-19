"use client";

import { useEffect, useRef, useState } from "react";

const SIZES = {
  sm: "h-7 w-[0.95rem] text-[0.7rem]",
  md: "h-10 w-[1.35rem] text-base",
  lg: "h-14 w-[1.9rem] text-2xl",
} as const;

/**
 * A Solari split-flap board.
 *
 * The whole product promise is "many possible inputs, one guaranteed output", so
 * the interface element that carries the brand is one that visibly resolves a
 * changing value into a settled one.
 *
 * Cells are keyed by character *and* by a per-render generation counter, so React
 * remounts them on every change and the CSS animation replays. Staggering by index
 * produces the left-to-right clatter of a real board.
 */
export function FlapBoard({
  value,
  width,
  size = "md",
  className = "",
}: {
  value: string;
  /** Pad or truncate to a fixed cell count so the board never reflows. */
  width?: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const cells = padTo(value.toUpperCase(), width ?? value.length);

  // Bumped whenever the value changes, to force a remount and replay the flap.
  const generation = useRef(0);
  const previous = useRef(value);
  if (previous.current !== value) {
    previous.current = value;
    generation.current += 1;
  }

  return (
    <div
      className={`flex gap-[3px] ${className}`}
      role="img"
      aria-label={value}
      style={{ perspective: "300px" }}
    >
      {cells.map((char, index) => (
        <span
          key={`${generation.current}-${index}-${char}`}
          className={`flap-cell flap-seam relative flex items-center justify-center rounded-[2px] bg-ink font-board font-bold tabular-nums text-amber shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] ${SIZES[size]}`}
          style={{ animationDelay: `${index * 28}ms` }}
          aria-hidden
        >
          {char === " " ? " " : char}
        </span>
      ))}
    </div>
  );
}

/**
 * Cycles through `options`, then settles on `resolvesTo` and stays there.
 * Used on the landing page: whatever you send, it always lands the same way.
 */
export function FlapCycler({
  options,
  resolvesTo,
  width,
  size = "md",
  intervalMs = 1100,
  className = "",
}: {
  options: string[];
  resolvesTo: string;
  width?: number;
  size?: keyof typeof SIZES;
  intervalMs?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const settled = index >= options.length;

  useEffect(() => {
    if (settled) return;
    const timer = setTimeout(() => setIndex((i) => i + 1), intervalMs);
    return () => clearTimeout(timer);
  }, [index, settled, intervalMs]);

  // Loop the demonstration so a judge arriving mid-cycle still sees the point.
  useEffect(() => {
    if (!settled) return;
    const timer = setTimeout(() => setIndex(0), intervalMs * 2.6);
    return () => clearTimeout(timer);
  }, [settled, intervalMs]);

  return (
    <FlapBoard
      value={settled ? resolvesTo : options[index]}
      width={width}
      size={size}
      className={className}
    />
  );
}

/** Centre the value across the board, as a real Solari display does. */
function padTo(value: string, width: number): string[] {
  const trimmed = value.slice(0, width);
  const left = Math.floor((width - trimmed.length) / 2);
  return trimmed.padStart(trimmed.length + left, " ").padEnd(width, " ").split("");
}
