# Catch-all

**An address that can't be paid wrong.**

Share one link. People send whatever they're holding, from whichever chain they're on.
It always reaches you as USDC on Arbitrum.

**Live demo:** https://uxmaxx-seven.vercel.app

---

## The problem

Sending crypto to the wrong chain is one of the most common ways ordinary people
permanently lose money. Every existing fix is a warning label — "make sure you select
the right network" — which puts the burden on the person least equipped to carry it.

Chain abstraction is usually sold as *convenience*: fewer clicks, no bridge UI.
Catch-all sells it as **safety**. The recipient's link accepts anything, and the
recipient always receives one predictable asset on one predictable chain. There is no
network selector to get wrong, because there is no network selector.

**Nothing is held in between.** Payments move directly from payer to recipient in a
single Universal Accounts operation — no escrow contract, no relayer wallet, no
custody. There is no intermediate account that can be drained, frozen, or lost, and no
"claim" step where funds sit somewhere waiting. This is the reason several adjacent
ideas were rejected during design: time locks, undo windows and marketplace escrow all
require holding someone else's money, and none of them survive that constraint.

## What it does

| | |
|---|---|
| **Receive link** (`/r/<address>`) | Anyone pays you any amount, from any chain. You get USDC on Arbitrum. |
| **Paid link** (`/u/<address>`) | Put a price on something. Buyers pay from any chain and get it immediately. |

Both run through the same payment engine. Neither requires the payer to have a wallet,
a seed phrase, a bridge, or a gas token.

## How it works

**The account.** Signing in with an email creates a Magic embedded wallet — a normal
EOA. Particle's Universal Accounts SDK then runs in **EIP-7702 mode**, which upgrades
that EOA *in place*: same address, no migration, no smart-account deployment.

You can see this directly at [`/debug`](https://uxmaxx-seven.vercel.app/debug): the
Universal Account address and the EOA address are **identical**. In Smart Account mode
they would differ. That equality is the proof 7702 is active.

**The payment.** Payments settle as USDC on Arbitrum. If the payer already holds USDC
there, it's a single same-chain transfer. If their money is on another chain, the app
first sources it across with a convert, then delivers — the payer sees one flow and
never picks a network. Gas is covered from Primary Assets, so no ETH on Arbitrum is
required.

**The delegation.** EIP-7702 authorizations are signed via
`magic.wallet.sign7702Authorization()`. Magic cannot sign chain-agnostic
(`chainId: 0`) authorizations, which is what the UA SDK emits by default, so each
chain is delegated explicitly — and delegation is required on every chain the payer
spends *from*, not on the destination. Authorization signatures are deduped by
`(chainId, nonce)`, since nonces are per-chain.

## Verified on-chain

**A cross-chain payment, settled in one Universal Accounts operation.** 3 USDC was
delivered on Base while only ~$0.72 of it existed there — the shortfall was sourced
from Arbitrum automatically:

| Leg | Chain | Transaction |
|---|---|---|
| Source | Arbitrum | [`0x037055d1…`](https://arbiscan.io/tx/0x037055d153a439effa0b3bd0928c489aeb3d7004929cc8ff171bd6c12f561777) |
| Delivery | Base | [`0x07311f61…`](https://basescan.org/tx/0x07311f616b4c677d06cb97a6638435cfcd713d44c1b9bb83593f511f0d206dd1) |

Balances moved `Arbitrum USDC 4.6077 → 2.3256` and `Base USDC 0.9999 → 4.0000`.

**A payment to another person**, settled on Arbitrum:
[`0x058da2e5…`](https://arbiscan.io/tx/0x058da2e5be92ce6d465b7e97f71b4e5f1e78855e4dffc29fb853d9a923ff1127)
— 1 USDC from a Magic embedded wallet created by email login.

### The distinction that matters

`createTransferTransaction` is **same-chain**: it moves a token already held on the
destination chain, and returns `Insufficient primary token balance` when the money is
anywhere else — regardless of how much the account holds in total.
`createConvertTransaction` is the **cross-chain** primitive; its type has no
`receiver` because it sources an asset onto a chain rather than paying anyone.

A cross-chain payment is therefore convert (source across) followed by transfer
(deliver locally), which is what this app does when the payer's funds live elsewhere.

Note also that Universal Accounts prefers local liquidity: a small convert to a chain
that can already fund it executes same-chain. Only a request exceeding local holdings
actually crosses.

## Track requirements

- **Universal Accounts SDK in EIP-7702 mode** — `useEIP7702: true`; verified by EOA/UA
  address equality, both in the browser and headlessly via `scripts/measure-fees.mjs`
- **A cross-chain operation moving value via UA** — verified above: one operation, two
  chains, both legs successful on-chain
- **Arbitrum** — the settlement chain for every payment; the account is delegated there
- **Magic** — embedded wallet, email OTP, and the EIP-7702 authorization signer
- **Functional demo** — deployed, plus runnable locally

## Deliberate limitations

Stated plainly rather than hidden:

- **Paid-link payloads are obfuscated, not secret.** Link state lives entirely in the
  URL (base64), so anyone can decode a paid link without paying. A production build
  would hold the payload server-side and release it only after confirming payment.
  This was a deliberate trade: no database means no escrow, no custody, and no
  deployment complexity.
- **Mainnet only.** Universal Accounts supports no testnets — verified by inspecting
  the SDK's chain enum, which contains only mainnet IDs. Every test costs real money.
- **No transaction history in the UI.** Balances are read live from the SDK; past
  payments aren't stored anywhere, because nothing is stored anywhere.
- **BNB Chain funds are unspendable.** Magic cannot sign EIP-7702 authorizations
  there, so value held on BNB Chain can't be routed through this flow.
- **Delegation is per-chain and costs gas.** Spending from a chain requires delegating
  on it first, which needs a little native token there.

## Running locally

```bash
npm install
cp .env.local.example .env.local   # then fill in your own keys
npm run dev
```

Required environment variables:

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_MAGIC_API_KEY` | dashboard.magic.link — publishable key |
| `NEXT_PUBLIC_PARTICLE_PROJECT_ID` | dashboard.particle.network — project |
| `NEXT_PUBLIC_PARTICLE_CLIENT_KEY` | dashboard.particle.network — project |
| `NEXT_PUBLIC_PARTICLE_APP_ID` | dashboard.particle.network — the **web app** inside the project |
| `NEXT_PUBLIC_ARBITRUM_RPC_URL` | any Arbitrum RPC; defaults to the public one |

## Notable implementation details

- `postinstall` patches the UA SDK's `package.json` `exports` map, which omits a
  `types` condition and would otherwise leave the whole SDK typed as `any` under
  `moduleResolution: "bundler"`. Fixing this via `tsconfig` `paths` instead is a trap:
  Turbopack honours `paths` at runtime too, so the import resolves to a `.d.ts` with no
  runtime exports.
- `watchOptions.pollIntervalMs` is set because this project lives on a Windows drive
  mounted into WSL2, where inotify events never fire.

## Stack

Next.js 16 · React 19 · Tailwind v4 · `@particle-network/universal-account-sdk` 2.0.3 ·
`magic-sdk` 33.9.0 · `@magic-ext/evm` 1.7.0 · ethers 6
