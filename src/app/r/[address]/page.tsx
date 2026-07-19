import { PayFlow } from "@/components/PayFlow";

/**
 * A recipient's catch-all link. The address is the whole link state — no database,
 * no lookup, nothing to keep in sync. `?n=` carries a display name so the payer
 * sees a person rather than a hex string.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ n?: string }>;
}) {
  const { address } = await params;
  const { n } = await searchParams;
  return <PayFlow recipient={address} recipientName={n} />;
}
