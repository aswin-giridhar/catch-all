/**
 * Chain + environment constants.
 *
 * Arbitrum One is the settlement chain for this app: the EOA is delegated here
 * via EIP-7702, and value lands here regardless of where it started.
 */

export const ARBITRUM_CHAIN_ID = 42161;

export const ARBITRUM_RPC_URL =
  process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ?? "https://arb1.arbitrum.io/rpc";

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
