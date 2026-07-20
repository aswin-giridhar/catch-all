import { UniversalAccount, UNIVERSAL_ACCOUNT_VERSION, ZeroAddress } from "@particle-network/universal-account-sdk";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync("./.env.local","utf8").split("\n").filter(l=>l.trim()&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const owner = "0x9bA9442C6C2fa63978bAC7fA2bccE808443644EE";
const ua = new UniversalAccount({ projectId: env.NEXT_PUBLIC_PARTICLE_PROJECT_ID, projectClientKey: env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY, projectAppUuid: env.NEXT_PUBLIC_PARTICLE_APP_ID, smartAccountOptions:{ useEIP7702:true, name:"UNIVERSAL", version:UNIVERSAL_ACCOUNT_VERSION, ownerAddress:owner }, tradeConfig:{ slippageBps:100 }});
const NAMES={1:"Ethereum",56:"BNB",8453:"Base",42161:"Arbitrum"};
const cases = [
  ["ETH on Arbitrum (same token, same chain)", { chainId:42161, address:ZeroAddress }, "1"],
  ["ETH on Arbitrum small",                    { chainId:42161, address:ZeroAddress }, "0.3"],
  ["ETH on Base (same token, CROSS-chain)",    { chainId:8453,  address:ZeroAddress }, "1"],
  ["ETH on Ethereum (same token, CROSS-chain)",{ chainId:1,     address:ZeroAddress }, "1"],
];
for (const [label, token, amount] of cases) {
  try {
    const tx = await ua.createTransferTransaction({ token, amount, receiver: owner });
    const chains=[...new Set((tx.userOps??[]).map(o=>NAMES[o.chainId]??o.chainId))];
    console.log(`OK      ${label.padEnd(44)} $${amount}  via [${chains.join(", ")}]`);
  } catch(e){ console.log(`FAILED  ${label.padEnd(44)} $${amount}  ${e.message?.slice(0,50)}`); }
}
