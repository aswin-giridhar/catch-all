import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans, Martian_Mono } from "next/font/google";
import "./globals.css";
import { MagicProvider } from "@/components/providers/MagicProvider";
import { UniversalAccountProvider } from "@/components/providers/UniversalAccountProvider";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

const body = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

// Squarish and mechanical — reads as a departure board, and keeps amounts aligned.
const board = Martian_Mono({
  variable: "--font-board",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Catch-all — an address that can't be paid wrong",
  description:
    "Send any coin from any chain. It always arrives as USDC on Arbitrum. No wallet, no bridge, no gas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${board.variable} h-full antialiased`}
    >
      <body className="paper-grain min-h-full flex flex-col">
        <MagicProvider>
          <UniversalAccountProvider>{children}</UniversalAccountProvider>
        </MagicProvider>
      </body>
    </html>
  );
}
