import { NextResponse, type NextRequest } from "next/server";
import { getLoginHref } from "@/lib/auth/return-url";
import { getVerificationHref, getVerificationReturnPath } from "@/lib/auth/email-verification";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = getVerificationReturnPath(params.get("next"));
  const tokenHash = params.get("token_hash");
  const code = params.get("code");
  const type = params.get("type");
  const failure = new URL(getVerificationHref(next), request.url);
  failure.searchParams.set("error", "confirmation");

  function response(url: URL) {
    // An explicit empty fragment prevents the browser forwarding an old implicit-flow token fragment.
    url.hash = "#";
    const result = NextResponse.redirect(url);
    result.headers.set("Cache-Control", "private, no-store");
    result.headers.set("Referrer-Policy", "no-referrer");
    return result;
  }

  // Signup tokens are opaque; Supabase may use different lengths and a PKCE prefix.
  if (params.has("error") || params.has("error_code") ||
    (!code && !tokenHash) || (code && tokenHash) ||
    (type && type !== "signup") ||
    (tokenHash && type !== "signup") ||
    (code && code.length > 2048) || (tokenHash && !/^[A-Za-z0-9_-]{1,2048}$/.test(tokenHash))) {
    return response(failure);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = tokenHash
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "signup" })
      : await supabase.auth.exchangeCodeForSession(code ?? "");

    if (error || !data.user?.email_confirmed_at || !data.session ||
      ("redirectType" in data && data.redirectType === "recovery")) {
      if (data.session) await supabase.auth.signOut({ scope: "local" });
      return response(failure);
    }

    // Confirmation finishes at login, preserving the existing password-sign-in flow.
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) return response(failure);
    const destination = new URL(getLoginHref(next), request.url);
    destination.searchParams.set("confirmed", "1");
    return response(destination);
  } catch {
    return response(failure);
  }
}
