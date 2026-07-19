"use client";

import { EVMExtension } from "@magic-ext/evm";
import { Magic as MagicBase } from "magic-sdk";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ARBITRUM_CHAIN_ID, ARBITRUM_RPC_URL, MAGIC_API_KEY } from "@/lib/constants";

export type Magic = MagicBase<[EVMExtension]>;

type MagicContextValue = {
  magic: Magic | null;
  /** The user's EOA. This same address becomes the Universal Account under EIP-7702. */
  address: string | null;
  isReady: boolean;
  isAuthenticating: boolean;
  loginWithEmail: (email: string) => Promise<void>;
  logout: () => Promise<void>;
};

const MagicContext = createContext<MagicContextValue>({
  magic: null,
  address: null,
  isReady: false,
  isAuthenticating: false,
  loginWithEmail: async () => {},
  logout: async () => {},
});

export const useMagic = () => useContext(MagicContext);

/**
 * Magic must never be constructed during SSR — it creates an iframe and touches
 * `window`. Constructing inside useEffect (and null-guarding every consumer) is
 * Magic's own documented pattern.
 */
export function MagicProvider({ children }: { children: ReactNode }) {
  const [magic, setMagic] = useState<Magic | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    const instance = new MagicBase(MAGIC_API_KEY(), {
      // With the EVM extension the top-level `network` option is omitted —
      // the extension owns chain configuration and enables chain switching.
      extensions: [
        new EVMExtension([
          { rpcUrl: ARBITRUM_RPC_URL, chainId: ARBITRUM_CHAIN_ID, default: true },
        ]),
      ],
    }) as Magic;

    setMagic(instance);

    // Sessions persist ~7 days, so a returning user should land already signed in.
    instance.user
      .isLoggedIn()
      .then(async (loggedIn) => {
        if (loggedIn) setAddress(await readAddress(instance));
      })
      .catch(() => {
        // A failed session probe is not fatal — treat it as "logged out".
      })
      .finally(() => setIsReady(true));
  }, []);

  const loginWithEmail = useCallback(
    async (email: string) => {
      if (!magic) throw new Error("Magic is not ready yet");
      setIsAuthenticating(true);
      try {
        await magic.auth.loginWithEmailOTP({ email, showUI: true });
        setAddress(await readAddress(magic));
      } finally {
        setIsAuthenticating(false);
      }
    },
    [magic],
  );

  const logout = useCallback(async () => {
    if (!magic) return;
    await magic.user.logout();
    setAddress(null);
  }, [magic]);

  const value = useMemo(
    () => ({ magic, address, isReady, isAuthenticating, loginWithEmail, logout }),
    [magic, address, isReady, isAuthenticating, loginWithEmail, logout],
  );

  return <MagicContext.Provider value={value}>{children}</MagicContext.Provider>;
}

/**
 * SDK v30 moved the address from `metadata.publicAddress` to
 * `metadata.wallets.ethereum.publicAddress`. We read the current shape but fall
 * back to the legacy one, so a shape surprise degrades instead of crashing.
 */
async function readAddress(magic: Magic): Promise<string | null> {
  const metadata = (await magic.user.getInfo()) as {
    publicAddress?: string | null;
    wallets?: { ethereum?: { publicAddress?: string | null } };
  };
  return metadata.wallets?.ethereum?.publicAddress ?? metadata.publicAddress ?? null;
}
