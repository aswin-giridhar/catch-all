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
import { ARBITRUM_CHAIN_ID, PARTICLE_CONFIG } from "@/lib/constants";
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
   * Delegate the EOA on Arbitrum.
   *
   * Magic cannot sign chain-agnostic (chainId: 0) authorizations, which is what the
   * UA SDK emits by default — so we delegate explicitly on Arbitrum first.
   *
   * The nonce is `auth.nonce + 1` because this delegation is itself a transaction
   * sent from the EOA, consuming a nonce before the authorization takes effect.
   */
  const ensureDelegated = useCallback(async () => {
    if (!universalAccount || !magic || !address) {
      throw new Error("Universal Account is not ready");
    }

    const deployments = await universalAccount.getEIP7702Deployments();
    const arbitrum = (deployments as Array<{ chainId: number; isDelegated?: boolean }>).find(
      (d) => d.chainId === ARBITRUM_CHAIN_ID,
    );
    if (arbitrum?.isDelegated) {
      setIsDelegated(true);
      return;
    }

    await magic.evm.switchChain(ARBITRUM_CHAIN_ID);
    const [auth] = await universalAccount.getEIP7702Auth([ARBITRUM_CHAIN_ID]);
    const authorization = await signAuthorization(
      magic,
      auth.address,
      ARBITRUM_CHAIN_ID,
      auth.nonce + 1,
    );

    await magic.wallet.send7702Transaction({
      to: address, // self-call; the authorizationList is what does the work
      data: "0x",
      authorizationList: [authorization],
    });

    await refreshDelegation();
  }, [universalAccount, magic, address, signAuthorization, refreshDelegation]);

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
      const signatureByNonce = new Map<number, string>();

      for (const userOp of transaction.userOps ?? []) {
        if (!userOp.eip7702Auth || userOp.eip7702Delegated) continue;

        const { nonce, address: contractAddress, chainId } = userOp.eip7702Auth;
        let serialized = signatureByNonce.get(nonce);

        if (!serialized) {
          const authorization = await signAuthorization(
            magic,
            contractAddress,
            chainId ?? userOp.chainId ?? ARBITRUM_CHAIN_ID,
            nonce,
          );
          serialized = Signature.from({
            r: authorization.r,
            s: authorization.s,
            v: authorization.v,
          }).serialized;
          signatureByNonce.set(nonce, serialized);
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
    ],
  );

  return <UAContext.Provider value={value}>{children}</UAContext.Provider>;
}
