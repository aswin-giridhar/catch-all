/**
 * Preflight for the real payment, run headlessly the moment funds land.
 *
 * Building a transaction needs no signer and no browser, so this answers the two
 * questions that decide the demo — where the money is, and whether Particle will
 * quote the cross-chain route — before anyone touches a login screen.
 *
 * It distinguishes "our code is wrong" from "Particle's routing is down", which
 * otherwise look identical from inside the app.
 *
 * Run: node scripts/preflight.mjs 0xYourAddress
 */
import { UniversalAccount, UNIVERSAL_ACCOUNT_VERSION } from "@particle-network/universal-account-sdk";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const ownerAddress = process.argv[2];
if (!ownerAddress) {
  console.error("usage: node scripts/preflight.mjs <ownerAddress>");
  process.exit(1);
}

const ARBITRUM = 42161;
const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const CHAIN_NAMES = {
  1: "Ethereum",
  56: "BNB Chain",
  101: "Solana",
  196: "X Layer",
  8453: "Base",
  42161: "Arbitrum",
};

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

const options = await ua.getSmartAccountOptions();
const sevenSevenZeroTwoActive =
  options.smartAccountAddress?.toLowerCase() === ownerAddress.toLowerCase();

console.log(`account      ${ownerAddress}`);
console.log(`7702 active  ${sevenSevenZeroTwoActive ? "yes — EOA is the UA" : "NO"}\n`);

// 1. Where is the money? Delegation is required on these chains, not the destination.
const assets = await ua.getPrimaryAssets();
console.log(`total        $${assets.totalAmountInUSD}`);

const fundedChains = new Map();
for (const asset of assets.assets ?? []) {
  for (const holding of asset.chainAggregation ?? []) {
    if (holding.amountInUSD > 0) {
      const chainId = holding.token.chainId;
      const name = CHAIN_NAMES[chainId] ?? chainId;
      const label = `${asset.tokenType} on ${name}`;
      fundedChains.set(chainId, name);
      console.log(`  ${label.padEnd(28)} $${holding.amountInUSD.toFixed(4)}`);
    }
  }
}

if (fundedChains.size === 0) {
  console.log("\n  no funds anywhere — nothing else can be tested yet.");
  process.exit(0);
}

// 2. Is the account delegated where the funds actually are?
console.log("\ndelegation");
const deployments = await ua.getEIP7702Deployments();
for (const d of deployments) {
  const needed = fundedChains.has(d.chainId);
  const name = CHAIN_NAMES[d.chainId] ?? d.chainId;
  if (needed || d.isDelegated) {
    console.log(
      `  ${String(name).padEnd(12)} delegated=${d.isDelegated}${needed && !d.isDelegated ? "   <-- REQUIRED, funds are here" : ""}`,
    );
  }
}

const crossChain = [...fundedChains.keys()].some((id) => id !== ARBITRUM);
console.log(
  `\nroute        ${crossChain ? "CROSS-CHAIN (satisfies the requirement)" : "same-chain only — funds are on Arbitrum, so a transfer to Arbitrum does NOT count as cross-chain"}`,
);

// 3. Will Particle actually quote it? This is the step other teams report failing.
for (const amount of ["1", "0.5", "0.2"]) {
  console.log(`\n--- quote $${amount} USDC -> Arbitrum ---`);
  try {
    const tx = await ua.createTransferTransaction({
      token: { chainId: ARBITRUM, address: USDC_ARBITRUM },
      amount,
      receiver: ownerAddress,
    });
    const fee = tx.feeQuotes?.[0]?.fees?.totals?.feeTokenAmountInUSD;
    console.log(`  OK   fee $${fee ?? "?"}   userOps ${tx.userOps?.length}`);
    console.log(`  chains involved: ${[...new Set((tx.userOps ?? []).map((op) => CHAIN_NAMES[op.chainId] ?? op.chainId))].join(", ")}`);
    console.log(`\n  => Route works. Fund the demo and run it in the browser.`);
    break;
  } catch (error) {
    console.log(`  FAILED  ${error.message}`);
    if (error.message?.includes("Insufficient primary token balance")) {
      console.log("          (either genuinely short, or the known cross-chain -32653 issue)");
    }
  }
}
