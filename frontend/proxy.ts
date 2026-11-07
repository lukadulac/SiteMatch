import { NextRequest, NextResponse } from "next/server";
import { getDashboardPath, isAppRole } from "@/lib/auth/roles";
import { buildContentSecurityPolicy, createNonce } from "@/lib/security/content-security-policy";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { isAccountEnabled } from "@/lib/auth/account-access";
import {
  applySupabaseCookies,
  createSupabaseMiddlewareClient,
} from "@/lib/supabase/middleware";

function redirectWithCookies(
  request: NextRequest,
  source: NextResponse,
  pathname: string,
) {
  const url = new URL(pathname, request.url);
  const response = NextResponse.redirect(url);

  return applySupabaseCookies(source, response);
}

function isGuardedPath(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname.startsWith("/oglasi/novi");
}

/**
 * Runs on every page: sets this request's Content-Security-Policy nonce (Next reads it
 * from the request header and stamps it on its own scripts), then applies the role
 * guards to the dashboard and the brief form.
 */
export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce, {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    isDev: process.env.NODE_ENV === "development",
  });
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", contentSecurityPolicy);
  const forwarded = new NextRequest(request, { headers });

  const response = isGuardedPath(request.nextUrl.pathname)
    ? await guardRoute(forwarded)
    : NextResponse.next({ request: forwarded });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  return response;
}

async function guardRoute(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.next({ request });
  }

  const { supabase, getResponse } = createSupabaseMiddlewareClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectWithCookies(request, getResponse(), "/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !isAppRole(profile.role)) {
    return redirectWithCookies(request, getResponse(), "/login");
  }

  if (!(await isAccountEnabled(supabase, user.id))) {
    await supabase.auth.signOut({ scope: "local" });
    return redirectWithCookies(request, getResponse(), "/login");
  }

  const pathname = request.nextUrl.pathname;
  const expectedDashboardPath = getDashboardPath(profile.role);

  if (pathname === "/dashboard") {
    return redirectWithCookies(request, getResponse(), expectedDashboardPath);
  }

  if (pathname.startsWith("/oglasi/novi")) {
    if (profile.role !== "client") {
      return redirectWithCookies(
        request,
        getResponse(),
        profile.role === "provider" ? "/oglasi" : expectedDashboardPath,
      );
    }
  }

  if (
    pathname.startsWith("/dashboard/client") &&
    profile.role !== "client"
  ) {
    return redirectWithCookies(request, getResponse(), expectedDashboardPath);
  }

  if (
    pathname.startsWith("/dashboard/provider") &&
    profile.role !== "provider"
  ) {
    return redirectWithCookies(request, getResponse(), expectedDashboardPath);
  }

  if (pathname.startsWith("/dashboard/admin") && profile.role !== "admin") {
    return redirectWithCookies(request, getResponse(), expectedDashboardPath);
  }

  return getResponse();
}

export const config = {
  // Every page, so each gets the CSP. Static files and API routes (JSON, no scripts) skip it.
  // Prefetches are not skipped: they must pass the dashboard guards too.
  matcher: ["/((?!api/|_next/static|_next/image|images/|icons/|favicon.ico|manifest.webmanifest).*)"],
};
