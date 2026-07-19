/**
 * Paid links carry their whole state in the URL — no database, no session.
 *
 * The payload is base64-encoded so a shared link doesn't display its own answer in
 * plain sight. This is obfuscation, NOT access control: anyone can decode it. A
 * production build would keep the payload server-side and release it only after
 * confirming payment. The demo is explicit about this rather than implying secrecy.
 */

export type PaidLink = {
  title: string;
  price: string;
  /** What the buyer gets: a message, a URL, a code. */
  payload: string;
};

export function encodePayload(value: string): string {
  // Handles non-ASCII correctly; btoa alone throws on multi-byte characters.
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodePayload(encoded: string): string {
  try {
    const normalised = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

export function buildPaidLink(origin: string, address: string, link: PaidLink): string {
  const params = new URLSearchParams({
    t: link.title,
    p: link.price,
    c: encodePayload(link.payload),
  });
  return `${origin}/u/${address}?${params.toString()}`;
}
