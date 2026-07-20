/**
 * Finds any spendable balance for an address across the chains that matter.
 *
 * Checks native + USDC/USDT on every chain Universal Accounts supports, and also on
 * a few it does NOT, so stranded funds show up as stranded rather than as nothing.
 *
 * Run: node scripts/find-funds.mjs 0xYourMetaMaskAddress
 */
const address = process.argv[2];
if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
  console.error("usage: node scripts/find-funds.mjs <0xAddress>");
  process.exit(1);
}

const CHAINS = [
  { name: "Ethereum", rpc: "https://ethereum-rpc.publicnode.com", native: "ETH", supported: true,
    tokens: { USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7" } },
  { name: "Base", rpc: "https://mainnet.base.org", native: "ETH", supported: true,
    tokens: { USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" } },
  { name: "Arbitrum", rpc: "https://arb1.arbitrum.io/rpc", native: "ETH", supported: true,
    tokens: { USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" } },
  { name: "BNB Chain", rpc: "https://bsc-dataseed.binance.org", native: "BNB", supported: true,
    tokens: { USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", USDT: "0x55d398326f99059fF775485246999027B3197955" } },
  // Not supported by Universal Accounts — flagged so stranded funds are visible.
  { name: "Polygon", rpc: "https://polygon-rpc.com", native: "POL", supported: false,
    tokens: { USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" } },
  { name: "Optimism", rpc: "https://mainnet.optimism.io", native: "ETH", supported: false,
    tokens: { USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" } },
];

async function rpc(url, method, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  const json = await response.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

const hex = (value) => BigInt(value ?? "0x0");

let foundAnything = false;

for (const chain of CHAINS) {
  const lines = [];
  try {
    const native = hex(await rpc(chain.rpc, "eth_getBalance", [address, "latest"]));
    if (native > 0n) {
      lines.push(`  ${chain.native.padEnd(6)} ${(Number(native) / 1e18).toFixed(6)}`);
    }

    for (const [symbol, token] of Object.entries(chain.tokens)) {
      // balanceOf(address)
      const data = `0x70a08231000000000000000000000000${address.slice(2).toLowerCase()}`;
      const raw = hex(await rpc(chain.rpc, "eth_call", [{ to: token, data }, "latest"]));
      // USDC/USDT are 6 decimals on every chain here except BNB Chain, where both are 18.
      const decimals = chain.name === "BNB Chain" ? 18 : 6;
      if (raw > 0n) {
        lines.push(`  ${symbol.padEnd(6)} ${(Number(raw) / 10 ** decimals).toFixed(4)}`);
      }
    }
  } catch (error) {
    console.log(`${chain.name}: could not read (${error.message})`);
    continue;
  }

  if (lines.length > 0) {
    foundAnything = true;
    const tag = chain.supported ? "" : "   <-- NOT supported by Universal Accounts";
    console.log(`\n${chain.name}${tag}`);
    console.log(lines.join("\n"));
  }
}

if (!foundAnything) {
  console.log("\nNothing found on any chain checked.");
} else {
  console.log("\nUA-supported source chains: Ethereum, Base, Arbitrum, BNB Chain, Solana.");
  console.log("For a CROSS-CHAIN demo the funds must NOT start on Arbitrum.");
}
