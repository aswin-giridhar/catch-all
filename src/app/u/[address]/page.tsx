import { PayFlow } from "@/components/PayFlow";
import { decodePayload } from "@/lib/paidLink";

/**
 * A paid link. Title, price and payload all travel in the URL, so there is nothing
 * to look up and nothing to keep in sync.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ t?: string; p?: string; c?: string }>;
}) {
  const { address } = await params;
  const { t, p, c } = await searchParams;

  return (
    <PayFlow
      recipient={address}
      title={t}
      price={p}
      unlocks={c ? decodePayload(c) : undefined}
    />
  );
}
