"use client";

import {
  UNIVERSAL_ACCOUNT_VERSION,
  UniversalAccount,
  type IAssetsResponse,
} from "@particle-network/universal-account-sdk";
import { BrowserProvider, getBytes, Signature } from "ethers";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ARBITRUM_CHAIN_ID,
  MAGIC_7702_CHAINS,
  PARTICLE_CONFIG,
  SOLANA_CHAIN_ID,
} from "@/lib/constants";
import { useMagic, type Magic } from "./MagicProvider";

type AccountInfo = {
  ownerAddress: string;
  evmAccount: string;
  solanaAccount: string;
};

/** Shape returned by the SDK's create*Transaction methods that we actually rely on. */
type UATransaction = {
  rootHash: string;
  userOps?: Array<{
    userOpHash: string;
    chainId?: number;
    eip7702Delegated?: boolean;
    eip7702Auth?: { address: string; chainId?: number; nonce: number };
  }>;
};

type UAContextValue = {
  universalAccount: UniversalAccount | null;
  accountInfo: AccountInfo | null;
  primaryAssets: IAssetsResponse | null;
  isDelegated: boolean;
  isLoading: boolean;
  refreshAssets: () => Promise<void>;
  ensureDelegated: () => Promise<void>;
  signAndSend: (transaction: UATransaction) => Promise<{ transactionId: string }>;
  /** Resolve Particle's internal transactionId into an explorer-resolvable hash. */
  resolveTxHash: (transactionId: string) => Promise<string | null>;
  /** Units of a primary token held on a specific chain. */
  heldOnChain: (tokenType: string, chainId: number) => number;
  /** Cross-chain: source an asset onto a chain from holdings anywhere. */
  convertOntoChain: (chainId: number, tokenType: string, amount: string) => Promise<{ transactionId: string }>;
};

const UAContext = createContext<UAContextValue>({
  universalAccount: null,
  accountInfo: null,
  primaryAssets: null,
  isDelegated: false,
  isLoading: false,
  refreshAssets: async () => {},
  ensureDelegated: async () => {},
  signAndSend: async () => ({ transactionId: "" }),
  resolveTxHash: async () => null,
  heldOnChain: () => 0,
  convertOntoChain: async () => ({ transactionId: "" }),
});

export const useUniversalAccount = () => useContext(UAContext);

export function UniversalAccountProvider({ children }: { children: ReactNode }) {
  const { magic, address } = useMagic();
  const [universalAccount, setUniversalAccount] = useState<UniversalAccount | null>(null);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [primaryAssets, setPrimaryAssets] = useState<IAssetsResponse | null>(null);
  const [isDelegated, setIsDelegated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setUniversalAccount(null);
      setAccountInfo(null);
      setPrimaryAssets(null);
      setIsDelegated(false);
      return;
    }

    setUniversalAccount(
      new UniversalAccount({
        ...PARTICLE_CONFIG(),
        smartAccountOptions: {
          // The EOA itself becomes the Universal Account. No new address, no migration.
          useEIP7702: true,
          name: "UNIVERSAL",
          version: UNIVERSAL_ACCOUNT_VERSION,
          ownerAddress: address,
        },
        // `universalGas` existed in SDK 1.x and was removed in 2.x — the reference
        // demo still passes it. 1% slippage tolerance on routed swaps.
        tradeConfig: { slippageBps: 100 },
      }),
    );
  }, [address]);

  const refreshDelegation = useCallback(async () => {
    if (!universalAccount) return;
    const deployments = await universalAccount.getEIP7702Deployments();
    const arbitrum = (deployments as Array<{ chainId: number; isDelegated?: boolean }>).find(
      (d) => d.chainId === ARBITRUM_CHAIN_ID,
    );
    setIsDelegated(arbitrum?.isDelegated ?? false);
  }, [universalAccount]);

  const refreshAssets = useCallback(async () => {
    if (!universalAccount) return;
    setPrimaryAssets(await universalAccount.getPrimaryAssets());
  }, [universalAccount]);

  useEffect(() => {
    if (!universalAccount || !address) return;
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        const options = await universalAccount.getSmartAccountOptions();
        if (cancelled) return;
        setAccountInfo({
          ownerAddress: address,
          evmAccount: options.smartAccountAddress ?? "",
          solanaAccount: options.solanaSmartAccountAddress ?? "",
        });
        await refreshDelegation();
        await refreshAssets();
      } catch (error) {
        console.error("Failed to load Universal Account state:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [universalAccount, address, refreshDelegation, refreshAssets]);

  const signAuthorization = useCallback(
    async (magicInstance: Magic, contractAddress: string, chainId: number, nonce: number) =>
      magicInstance.wallet.sign7702Authorization({ contractAddress, chainId, nonce }),
    [],
  );

  /**
   * Chains the payer actually holds value on. These are the chains that need
   * delegation — Particle confirmed that delegation is required on the SOURCE chain,
   * after which funds can be spent on any supported chain. Delegating only on the
   * destination is not sufficient.
   */
  const fundedChainIds = useCallback((): number[] => {
    const chains = new Set<number>();
    for (const asset of primaryAssets?.assets ?? []) {
      for (const holding of asset.chainAggregation ?? []) {
        if (holding.amountInUSD > 0) chains.add(holding.token.chainId);
      }
    }
    // Solana has no EIP-7702, and Magic cannot sign authorizations on every EVM
    // chain UA supports — BNB Chain fails with "Unable to get network info".
    // Value on an unsupported chain simply cannot be spent through this flow.
    chains.delete(SOLANA_CHAIN_ID);
    return [...chains].filter((chainId) => MAGIC_7702_CHAINS.includes(chainId));
  }, [primaryAssets]);

  /**
   * Delegate the EOA on every funded EVM chain that isn't delegated yet.
   *
   * Magic cannot sign chain-agnostic (chainId: 0) authorizations, which is what the
   * UA SDK emits by default, so each chain is delegated explicitly.
   *
   * The nonce is `auth.nonce + 1` because the delegation is itself a transaction sent
   * from the EOA, consuming a nonce before the authorization takes effect.
   *
   * Each delegation is a real transaction: the EOA pays gas on that chain.
   */
  const ensureDelegated = useCallback(async () => {
    if (!universalAccount || !magic || !address) {
      throw new Error("Universal Account is not ready");
    }

    const deployments = (await universalAccount.getEIP7702Deployments()) as Array<{
      chainId: number;
      isDelegated?: boolean;
    }>;
    const delegatedOn = new Set(
      deployments.filter((d) => d.isDelegated).map((d) => d.chainId),
    );

    // Only funded chains. The destination deliberately isn't forced in: Particle's
    // own demo settles to Solana, which cannot be delegated at all, so requiring
    // delegation on the destination would be wrong — and would demand gas on a chain
    // the payer may hold nothing on.
    const targets = fundedChainIds().filter((chainId) => !delegatedOn.has(chainId));

    for (const chainId of targets) {
      await magic.evm.switchChain(chainId);
      const [auth] = await universalAccount.getEIP7702Auth([chainId]);
      const authorization = await signAuthorization(
        magic,
        auth.address,
        chainId,
        auth.nonce + 1,
      );

      await magic.wallet.send7702Transaction({
        to: address, // self-call; the authorizationList is what does the work
        data: "0x",
        authorizationList: [authorization],
      });
    }

    await refreshDelegation();
  }, [universalAccount, magic, address, signAuthorization, refreshDelegation, fundedChainIds]);

  /**
   * Sign a prepared UA transaction and submit it.
   *
   * Authorizations are deduped by nonce: a transaction touching several chains can
   * reference one nonce repeatedly, and signing per-userOp would prompt the user
   * once per operation instead of once per nonce.
   */
  const signAndSend = useCallback(
    async (transaction: UATransaction) => {
      if (!universalAccount || !magic) {
        throw new Error("Universal Account is not ready");
      }

      const authorizations: Array<{ userOpHash: string; signature: string }> = [];
      const signatureByAuth = new Map<string, string>();

      for (const userOp of transaction.userOps ?? []) {
        if (!userOp.eip7702Auth || userOp.eip7702Delegated) continue;

        const { nonce, address: contractAddress } = userOp.eip7702Auth;

        // The SDK emits chain-agnostic authorizations as chainId 0, which Magic
        // cannot sign. 0 is falsy but NOT nullish, so `??` would pass it straight
        // through to Magic and fail. `||` is load-bearing here, not a style choice.
        const chainId = userOp.eip7702Auth.chainId || userOp.chainId || ARBITRUM_CHAIN_ID;

        // Nonces are per-chain, so dedupe on (chain, nonce). Keying by nonce alone
        // would reuse one chain's signature on another — and a fresh account
        // typically sits at nonce 0 on every chain it hasn't touched.
        const key = `${chainId}:${nonce}`;
        let serialized = signatureByAuth.get(key);

        if (!serialized) {
          const authorization = await signAuthorization(magic, contractAddress, chainId, nonce);
          serialized = Signature.from({
            r: authorization.r,
            s: authorization.s,
            v: authorization.v,
          }).serialized;
          signatureByAuth.set(key, serialized);
        }

        authorizations.push({ userOpHash: userOp.userOpHash, signature: serialized });
      }

      // rootHash must be signed as RAW BYTES. Passing the hex string would sign the
      // wrong payload and the transaction would be rejected.
      const provider = new BrowserProvider(magic.rpcProvider as never);
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(getBytes(transaction.rootHash));

      return universalAccount.sendTransaction(
        transaction as never,
        signature,
        authorizations.length > 0 ? authorizations : undefined,
      );
    },
    [universalAccount, magic, signAuthorization],
  );

  /**
   * How much of a given primary token the account holds on a given chain.
   * Used to decide whether a payment needs cross-chain sourcing first.
   */
  const heldOnChain = useCallback(
    (tokenType: string, chainId: number): number => {
      for (const asset of primaryAssets?.assets ?? []) {
        if (asset.tokenType !== tokenType) continue;
        for (const holding of asset.chainAggregation ?? []) {
          if (holding.token.chainId === chainId) return holding.amount;
        }
      }
      return 0;
    },
    [primaryAssets],
  );

  /**
   * Source an asset onto a target chain from holdings anywhere.
   *
   * This is the cross-chain operation. `createTransferTransaction` only moves a token
   * already held on the destination chain — it is same-chain by design, which is why
   * it returns "Insufficient primary token balance" even with a healthy balance
   * elsewhere. Convert is what actually crosses chains.
   */
  const convertOntoChain = useCallback(
    async (chainId: number, tokenType: string, amount: string) => {
      if (!universalAccount) throw new Error("Universal Account is not ready");
      const transaction = await universalAccount.createConvertTransaction({
        chainId,
        expectToken: { type: tokenType as never, amount },
      });
      return signAndSend(transaction as never);
    },
    [universalAccount, signAndSend],
  );

  /**
   * Turn a Universal Accounts transactionId into a real on-chain transaction hash.
   *
   * `sendTransaction` returns Particle's internal id (short, e.g. 0x0657013162e1e3),
   * which no block explorer can resolve. The actual hash appears on the user
   * operations inside the transaction detail, and only once the bundle has landed —
   * so this polls briefly rather than reading once.
   */
  const resolveTxHash = useCallback(
    async (transactionId: string): Promise<string | null> => {
      if (!universalAccount) return null;

      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          const detail = (await universalAccount.getTransaction(transactionId)) as Record<
            string,
            unknown
          >;
          const groups = [
            "settlementUserOperations",
            "lendingUserOperations",
            "depositUserOperations",
            "refundUserOperations",
          ];
          for (const group of groups) {
            const ops = detail?.[group];
            if (!Array.isArray(ops)) continue;
            const withHash = ops.find(
              (op: { txHash?: string }) => typeof op?.txHash === "string" && op.txHash.length === 66,
            ) as { txHash: string } | undefined;
            if (withHash) return withHash.txHash;
          }
        } catch {
          // Detail isn't available immediately after submission; keep polling.
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      return null;
    },
    [universalAccount],
  );

  const value = useMemo(
    () => ({
      universalAccount,
      accountInfo,
      primaryAssets,
      isDelegated,
      isLoading,
      refreshAssets,
      ensureDelegated,
      signAndSend,
      resolveTxHash,
      heldOnChain,
      convertOntoChain,
    }),
    [
      universalAccount,
      accountInfo,
      primaryAssets,
      isDelegated,
      isLoading,
      refreshAssets,
      ensureDelegated,
      signAndSend,
      resolveTxHash,
      heldOnChain,
      convertOntoChain,
    ],
  );

  return <UAContext.Provider value={value}>{children}</UAContext.Provider>;
}
