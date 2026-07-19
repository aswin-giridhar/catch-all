# Submission pack

Everything needed to fill in the Encode submission form and record the demo.

## Links

| | |
|---|---|
| Live demo | https://uxmaxx-seven.vercel.app |
| Repository | https://github.com/aswin-giridhar/catch-all |
| Verify EIP-7702 yourself | https://uxmaxx-seven.vercel.app/debug |

## Track and bounties

- **Main track:** Universal Accounts Track
- **Bonus:** Arbitrum "Road to Open House London" — every payment settles on Arbitrum
- **Bonus:** Magic Labs — Magic is the embedded wallet, the login, and the EIP-7702
  authorization signer

## One-liner

An address that can't be paid wrong.

## Short description

Sending crypto to the wrong chain is one of the most common ways ordinary people
permanently lose money, and every existing fix is just a warning label. Catch-all
removes the failure mode instead of warning about it: you share one link, people pay
with whatever they're holding on whichever chain they're on, and it always arrives as
USDC on Arbitrum.

Signing in with an email creates a Magic embedded wallet. Particle's Universal Accounts
SDK then runs in EIP-7702 mode, upgrading that EOA in place — same address, no
migration, no smart-account deployment. Payments route from any supported chain and
settle on Arbitrum, with gas covered from whatever assets the payer already holds.

Chain abstraction is usually sold as convenience. Here it's sold as safety.

## Demo video — shot list

Target 90 seconds. Two devices or two browser profiles: one is you, one is a person
who has never used crypto.

1. **The promise (10s)** — landing page. The split-flap board cycles through
   `USDT · BNB`, `ETH · BASE`, `SOL · SOLANA` and always resolves to `USDC · ARBITRUM`.
   Say the line: *an address that can't be paid wrong.*
2. **Get a link (15s)** — type an email, enter the code, land on home. Point out there
   was no wallet install, no seed phrase, no network selector. Copy the link.
3. **The reveal (10s)** — open `/debug`. Show that the Universal Account address and
   the EOA address are **identical**. Say why: EIP-7702 upgraded the existing account
   in place rather than creating a new one.
4. **Someone pays (30s)** — private window, open the link, sign in with a *different*
   email. This wallet did not exist ten seconds ago. Enter an amount, review the fee,
   send.
5. **The receipt (15s)** — the board flips to `USDC · ARBITRUM`. Open the Arbiscan
   link. The money started somewhere else and arrived here, and nobody chose a network.
6. **Paid links (10s)** — `/new`, put $2 on something, show the buyer unlocking it.

**The single most important beat is step 4→5.** That's the cross-chain operation, and
it's what the track requires.

## Judging criteria — how this answers them

**UX excellence (40%).** No wallet, no seed phrase, no network selector, no gas token,
no bridge. A payer with zero crypto experience completes a cross-chain payment with an
email address and one button. The only crypto vocabulary anywhere in the interface is
the name of the asset that arrives.

**Prominent use of Universal Accounts + EIP-7702 (30%).** The product is not a nicer
wrapper on something that already works — it cannot exist without chain abstraction.
7702 mode is what makes the promise honest: the recipient's address is their ordinary
EOA, upgraded in place, so the link they share is just their address. `/debug` lets a
judge verify this in five seconds.

**Adoption potential (20%).** Wrong-chain sends destroy real money every day. The
receive link is useful to anyone who has ever posted an address publicly; the paid link
gives creators a payment method that works regardless of what the buyer holds.

**Technical quality (10%).** No database, no escrow, no custody, no smart contract —
link state lives in the URL. Two upstream packaging defects are worked around and
documented rather than hacked around silently.

## Known limitations (stated, not hidden)

- Paid-link payloads are base64 in the URL: obfuscated, not secret. Production would
  gate them server-side behind a payment check.
- Universal Accounts is mainnet-only — verified by inspecting the SDK's chain enum —
  so there is no testnet path and every test costs real money.
- No payment history, because nothing is stored anywhere.
