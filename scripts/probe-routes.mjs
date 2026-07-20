/**
 * Determines WHICH routes are broken, rather than assuming "cross-chain is down".
 *
 * Quoting is read-only and free, so we can map the failure surface precisely:
 * is it cross-chain sourcing in general, or Arbitrum as a destination specifically?
 * The answer decides whether the product's settlement chain has to change.
 *
 * Run: node scripts/probe-routes.mjs <address>
 */
import { UniversalAccount, UNIVERSAL_ACCOUNT_VERSION } from "@particle-network/universal-account-sdk";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const ownerAddress = process.argv[2];
if (!ownerAddress) {
  console.error("usage: node scripts/probe-routes.mjs <address>");
  process.exit(1);
}

const TOKENS = {
  "USDC on Arbitrum": { chainId: 42161, address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
  "USDC on Base": { chainId: 8453, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  "USDC on Ethereum": { chainId: 1, address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
  "USDT on BNB Chain": { chainId: 56, address: "0x55d398326f99059fF775485246999027B3197955" },
};

const CHAIN_NAMES = { 1: "Ethereum", 56: "BNB", 101: "Solana", 196: "X Layer", 8453: "Base", 42161: "Arbitrum" };

const ua = new UniversalAccount({
  projectId: env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
  projectClientKey: env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
  projectAppUuid: env.NEXT_PUBLIC_PARTICLE_APP_ID,
  smartAccountOptions: {
    useEIP7702: true,
    name: "UNIVERSAL",
    version: UNIVERSAL_ACCOUNT_VERSION,
    ownerAddress,
  },
  tradeConfig: { slippageBps: 100 },
});

const assets = await ua.getPrimaryAssets();
console.log(`${ownerAddress}\ntotal $${assets.totalAmountInUSD.toFixed(4)}`);

const perChain = new Map();
for (const asset of assets.assets ?? []) {
  for (const holding of asset.chainAggregation ?? []) {
    if (holding.amountInUSD > 0) {
      perChain.set(
        holding.token.chainId,
        (perChain.get(holding.token.chainId) ?? 0) + holding.amountInUSD,
      );
    }
  }
}
for (const [chainId, usd] of perChain) {
  console.log(`  ${(CHAIN_NAMES[chainId] ?? chainId).padEnd(10)} $${usd.toFixed(4)}`);
}

console.log("\nroute probes (same-chain = sourced locally, CROSS = had to bridge):\n");

for (const [label, token] of Object.entries(TOKENS)) {
  const localBalance = perChain.get(token.chainId) ?? 0;
  // Deliberately exceed the destination-chain balance so sourcing MUST cross chains.
  const amount = (localBalance + 0.4).toFixed(2);

  try {
    const tx = await ua.createTransferTransaction({
      token,
      amount,
      receiver: ownerAddress,
    });
    const chains = [...new Set((tx.userOps ?? []).map((op) => CHAIN_NAMES[op.chainId] ?? op.chainId))];
    const isCross = chains.length > 1 || !chains.includes(CHAIN_NAMES[token.chainId]);
    console.log(
      `  OK      -> ${label.padEnd(20)} $${amount.padStart(6)}  via [${chains.join(", ")}]${isCross ? "  <-- CROSS-CHAIN WORKS" : ""}`,
    );
  } catch (error) {
    const short = error.message?.slice(0, 60);
    console.log(`  FAILED  -> ${label.padEnd(20)} $${amount.padStart(6)}  ${short}`);
  }
}
