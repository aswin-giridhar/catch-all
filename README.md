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

**The payment.** `createTransferTransaction` targets USDC on Arbitrum. The payer's
funds are sourced automatically from whatever Primary Assets they hold on any supported
chain — the SDK routes and covers gas from those assets, so the payer needs no ETH on
Arbitrum and no USDC anywhere in particular.

**The delegation.** EIP-7702 authorizations are signed via
`magic.wallet.sign7702Authorization()`. Magic cannot sign chain-agnostic (`chainId: 0`)
authorizations, which is what the UA SDK emits by default, so the account is delegated
explicitly on Arbitrum first. Authorization signatures are deduped by nonce, so a
transaction spanning several chains still asks the user to sign once.

## Track requirements

- **Universal Accounts SDK in EIP-7702 mode** — `useEIP7702: true`; verified by EOA/UA
  address equality, both in the browser and headlessly via `scripts/measure-fees.mjs`
- **A cross-chain operation moving value via UA** — the payer's assets are sourced from
  any supported chain and settle as USDC on Arbitrum
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
- **No transaction history.** Balances are read live from the SDK; past payments aren't
  stored anywhere, because nothing is stored anywhere.

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
