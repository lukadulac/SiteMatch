import { z } from "zod";
import { getSafeReturnPath } from "@/lib/auth/return-url";

export const confirmationEmailSchema = z.string().trim().email("Enter a valid email address.").max(254);

export function getVerificationReturnPath(value: unknown) {
  const safePath = getSafeReturnPath(value);
  if (!safePath) return null;

  // Auth destinations must not become the destination of another auth flow.
  const decodedPath = decodeURIComponent(safePath.split(/[?#]/)[0]);
  const pathname = new URL(decodedPath, "https://workbridge.local").pathname.toLowerCase().replace(/\/+$/, "");
  if (["/register", "/verify-email", "/login", "/auth"].includes(pathname) || pathname.startsWith("/auth/")) {
    return null;
  }
  return safePath;
}

export function getVerificationHref(next?: string | null) {
  const safeNext = getVerificationReturnPath(next);
  return safeNext ? `/verify-email?next=${encodeURIComponent(safeNext)}` : "/verify-email";
}

export function getRegistrationHref(next?: string | null) {
  const safeNext = getVerificationReturnPath(next);
  return safeNext ? `/register?next=${encodeURIComponent(safeNext)}` : "/register";
}
