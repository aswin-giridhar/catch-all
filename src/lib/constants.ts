/**
 * Chain + environment constants.
 *
 * Arbitrum One is the settlement chain for this app: the EOA is delegated here
 * via EIP-7702, and value lands here regardless of where it started.
 */

export const ARBITRUM_CHAIN_ID = 42161;
export const SOLANA_CHAIN_ID = 101;

export const ARBITRUM_RPC_URL =
  process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ?? "https://arb1.arbitrum.io/rpc";

/**
 * Every EVM chain Universal Accounts supports.
 *
 * All of them must be registered with Magic at init, because EIP-7702 delegation is
 * required on the chain the funds come FROM — not the chain they land on — and
 * `magic.evm.switchChain` only accepts chains it already knows about.
 */
export const UA_EVM_CHAINS = [
  { chainId: 1, rpcUrl: "https://ethereum-rpc.publicnode.com" },
  { chainId: 56, rpcUrl: "https://bsc-dataseed.binance.org" },
  { chainId: 196, rpcUrl: "https://rpc.xlayer.tech" },
  { chainId: 8453, rpcUrl: "https://mainnet.base.org" },
  { chainId: ARBITRUM_CHAIN_ID, rpcUrl: ARBITRUM_RPC_URL },
] as const;

/**
 * Chains where Magic can actually produce an EIP-7702 authorization.
 *
 * Magic's docs cite Ethereum, Sepolia, Arbitrum, Base and Optimism; BNB Chain and
 * X Layer are absent, and attempting to switch to BNB Chain fails with
 * "Unable to get network info". A funded chain that isn't on this list cannot be
 * used as a payment source, however much value sits on it.
 */
export const MAGIC_7702_CHAINS = [1, 8453, ARBITRUM_CHAIN_ID];

export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  56: "BNB Chain",
  101: "Solana",
  196: "X Layer",
  8453: "Base",
  42161: "Arbitrum",
};

export const ARBISCAN_TX_URL = (hash: string) => `https://arbiscan.io/tx/${hash}`;

/** USDC on Arbitrum One. Verified against Circle's canonical deployment. */
export const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

/**
 * Reading env at module scope keeps the failure loud and early: a missing key
 * surfaces as one clear error at startup rather than an opaque SDK error later.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it in .env.local — see .env.local for which dashboard it comes from.`,
    );
  }
  return value;
}

export const MAGIC_API_KEY = () =>
  required("NEXT_PUBLIC_MAGIC_API_KEY", process.env.NEXT_PUBLIC_MAGIC_API_KEY);

export const PARTICLE_CONFIG = () => ({
  projectId: required(
    "NEXT_PUBLIC_PARTICLE_PROJECT_ID",
    process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
  ),
  projectClientKey: required(
    "NEXT_PUBLIC_PARTICLE_CLIENT_KEY",
    process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
  ),
  projectAppUuid: required(
    "NEXT_PUBLIC_PARTICLE_APP_ID",
    process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
  ),
});

/** Block explorer per chain, so a cross-chain receipt links each leg correctly. */
export const EXPLORERS: Record<number, string> = {
  1: "https://etherscan.io",
  56: "https://bscscan.com",
  8453: "https://basescan.org",
  42161: "https://arbiscan.io",
};
