/**
 * Measures what a real cross-chain transfer actually costs, before spending anything.
 *
 * createTransferTransaction only BUILDS a transaction — no signer, no funds required.
 * So we can read the true fee preview (or the exact failure) on a $0 account instead
 * of guessing a funding figure.
 *
 * Run: node scripts/measure-fees.mjs 0xYourAddress
 */
import { UniversalAccount, UNIVERSAL_ACCOUNT_VERSION } from "@particle-network/universal-account-sdk";
import { readFileSync } from "node:fs";

// Minimal .env.local reader — avoids adding a dependency just for a throwaway script.
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
  console.error("usage: node scripts/measure-fees.mjs <ownerAddress>");
  process.exit(1);
}

const ARBITRUM = 42161;
const BASE = 8453;
const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

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

console.log(`owner: ${ownerAddress}\n`);

const options = await ua.getSmartAccountOptions();
console.log("smart account:", options.smartAccountAddress);
console.log("7702 active   :", options.smartAccountAddress?.toLowerCase() === ownerAddress.toLowerCase());

const assets = await ua.getPrimaryAssets();
console.log("total USD     :", assets.totalAmountInUSD, "\n");

console.log("--- EIP-7702 delegation status ---");
try {
  const deployments = await ua.getEIP7702Deployments();
  for (const d of deployments) {
    console.log(`  chain ${d.chainId}: delegated=${d.isDelegated}`);
  }
  const auth = await ua.getEIP7702Auth([ARBITRUM]);
  console.log("  arbitrum auth payload:", JSON.stringify(auth));
} catch (e) {
  console.log("  ERROR:", e.message);
}

// The real question: what does one cross-chain move cost, and does building it
// even succeed on an empty account?
for (const [label, amount] of [
  ["1 USDC", "1"],
  ["0.1 USDC", "0.1"],
]) {
  console.log(`\n--- createTransferTransaction: ${label} USDC(Arbitrum) -> Base ---`);
  try {
    const tx = await ua.createTransferTransaction({
      token: { chainId: ARBITRUM, address: USDC_ARBITRUM },
      amount,
      receiver: ownerAddress,
      rechargeChainId: BASE,
    });
    console.log("  built OK. rootHash:", tx.rootHash);
    console.log("  fees:", JSON.stringify(tx.fees?.totals ?? tx.fees, null, 2));
    console.log("  userOps:", tx.userOps?.length);
  } catch (e) {
    console.log("  FAILED:", e.message);
    if (e.response?.data) console.log("  detail:", JSON.stringify(e.response.data));
  }
}
