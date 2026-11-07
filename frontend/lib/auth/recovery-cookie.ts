/**
 * Set by /auth/recovery after a valid reset link, read by /reset-password. Its value is
 * the recovering user's id, so a stale marker never unlocks the form for someone else.
 */
export const RECOVERY_COOKIE = "wb_recovery";
export const RECOVERY_COOKIE_MAX_AGE_SECONDS = 15 * 60;
export const RECOVERY_COOKIE_PATH = "/reset-password";

export function recoveryCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: RECOVERY_COOKIE_PATH,
    maxAge: RECOVERY_COOKIE_MAX_AGE_SECONDS,
  };
}
