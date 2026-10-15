import "server-only";
import { getVerificationReturnPath } from "@/lib/auth/email-verification";

export function getAuthSiteOrigin() {
  // Never derive email destinations from untrusted Host/Origin request headers.
  const configured = process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("Set NEXT_PUBLIC_SITE_URL before enabling authentication emails.");
  }
  const url = new URL(configured || "http://localhost:3000");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
    url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an HTTPS origin (HTTP is allowed for localhost).");
  }
  return url.origin;
}

export function getEmailConfirmationUrl(next?: unknown) {
  const url = new URL("/auth/confirm", getAuthSiteOrigin());
  const safeNext = getVerificationReturnPath(next);
  // Keep a query parameter even without a destination so the hosted template can append &token_hash.
  url.searchParams.set("next", safeNext ?? "");
  return url.toString();
}
