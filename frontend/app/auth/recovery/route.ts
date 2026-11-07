import { NextResponse, type NextRequest } from "next/server";
import { getVerificationReturnPath } from "@/lib/contracts/auth/email-verification";
import { RECOVERY_COOKIE, recoveryCookieOptions } from "@/lib/auth/recovery-cookie";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The password reset email links here. Only a recovery token is accepted (the signup
 * callback stays in /auth/confirm); a valid one keeps the recovery session and opens
 * /reset-password, anything else goes back to /forgot-password with nothing forwarded.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = getVerificationReturnPath(params.get("next"));
  const tokenHash = params.get("token_hash");
  const failure = new URL("/forgot-password?error=link", request.url);

  function response(url: URL) {
    // An explicit empty fragment prevents the browser forwarding an old implicit-flow token fragment.
    url.hash = "#";
    const result = NextResponse.redirect(url);
    result.headers.set("Cache-Control", "private, no-store");
    result.headers.set("Referrer-Policy", "no-referrer");
    return result;
  }

  if (params.has("error") || params.has("error_code") || params.has("code") ||
    params.get("type") !== "recovery" ||
    !tokenHash || !/^[A-Za-z0-9_-]{1,2048}$/.test(tokenHash)) {
    return response(failure);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });

    if (error || !data.user || !data.session) {
      if (data.session) await supabase.auth.signOut({ scope: "local" });
      return response(failure);
    }

    const destination = new URL("/reset-password", request.url);
    if (next) destination.searchParams.set("next", next);
    const result = response(destination);
    result.cookies.set(RECOVERY_COOKIE, data.user.id, recoveryCookieOptions());
    return result;
  } catch {
    return response(failure);
  }
}
