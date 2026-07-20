import { UniversalAccount, UNIVERSAL_ACCOUNT_VERSION, ZeroAddress } from "@particle-network/universal-account-sdk";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync("./.env.local","utf8").split("\n").filter(l=>l.trim()&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const owner = "0x9bA9442C6C2fa63978bAC7fA2bccE808443644EE";
const ua = new UniversalAccount({ projectId: env.NEXT_PUBLIC_PARTICLE_PROJECT_ID, projectClientKey: env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY, projectAppUuid: env.NEXT_PUBLIC_PARTICLE_APP_ID, smartAccountOptions:{ useEIP7702:true, name:"UNIVERSAL", version:UNIVERSAL_ACCOUNT_VERSION, ownerAddress:owner }, tradeConfig:{ slippageBps:100 }});
const NAMES={1:"Ethereum",56:"BNB",8453:"Base",42161:"Arbitrum"};
const ETH_ARB  = { chainId:42161, address:ZeroAddress };
const ETH_BASE = { chainId:8453,  address:ZeroAddress };
const USDC_ARB = { chainId:42161, address:"0xaf88d065e77c8cC2239327C5EDb3A432268e5831" };
const cases = [
  ["0.001 ETH -> Arbitrum (same chain)", ETH_ARB,  "0.001"],
  ["0.002 ETH -> Arbitrum (same chain)", ETH_ARB,  "0.002"],
  ["0.001 ETH -> Base  (CROSS-CHAIN)",   ETH_BASE, "0.001"],
  ["0.5 USDC  -> Arbitrum (needs swap)", USDC_ARB, "0.5"],
  ["2 USDC    -> Arbitrum (needs swap)", USDC_ARB, "2"],
];
for (const [label, token, amount] of cases) {
  try {
    const tx = await ua.createTransferTransaction({ token, amount, receiver: owner });
    const chains=[...new Set((tx.userOps??[]).map(o=>NAMES[o.chainId]??o.chainId))];
    const fee = tx.feeQuotes?.[0]?.fees?.totals?.feeTokenAmountInUSD;
    console.log(`OK      ${label.padEnd(38)} via [${chains.join(", ")}]  fee=${fee ?? "?"}`);
  } catch(e){ console.log(`FAILED  ${label.padEnd(38)} ${e.message?.slice(0,45)}`); }
}
