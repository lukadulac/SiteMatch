import { NextRequest, NextResponse } from "next/server";
import { isCookieRemoval, parseSetCookie, type ParsedSetCookie } from "@/lib/api/cookies";
import { getInternalSecret } from "@/lib/api/internal";
import { getAuthCookieName } from "@/lib/contracts/auth/cookie-name";
import { getDashboardPath, isAppRole } from "@/lib/contracts/auth/roles";
import type { SessionState } from "@/lib/contracts/session";
import { buildContentSecurityPolicy, createNonce } from "@/lib/security/content-security-policy";

/** @supabase/ssr session cookies, chunked or not. */
const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

function isGuardedPath(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname.startsWith("/oglasi/novi");
}

type SessionCheck =
  | { ok: true; session: SessionState; cookies: ParsedSetCookie[] }
  | { ok: false };

/** Asks the backend who this is. It refreshes an expired token and returns the new cookies. */
async function readSession(request: NextRequest): Promise<SessionCheck> {
  const backend = process.env.BACKEND_URL;

  if (!backend) {
    return { ok: false };
  }

  try {
    const response = await fetch(`${backend}/api/session`, {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
        "x-internal-secret": getInternalSecret(),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return { ok: false };
    }

    // Different Supabase URLs give different cookie names, and every user would look signed
    // out. Treat it as an outage, not a sign-out.
    const expected = getAuthCookieName(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    const reported = response.headers.get("x-auth-cookie");

    if (reported !== expected) {
      console.error(
        `Session cookie mismatch: the backend uses ${reported ?? "no cookie name"}, the frontend ${expected}. ` +
          "Set the backend's SUPABASE_URL to exactly NEXT_PUBLIC_SUPABASE_URL.",
      );
      return { ok: false };
    }

    const body = (await response.json()) as { data?: SessionState };
    const cookies = response.headers
      .getSetCookie()
      .map(parseSetCookie)
      .filter((cookie): cookie is ParsedSetCookie => cookie !== null);

    return { ok: true, session: body.data ?? null, cookies };
  } catch {
    return { ok: false };
  }
}

/**
 * Server Components cannot write cookies, so the refreshed session is stored here: in the
 * browser (response) and in the cookie header the rest of this request renders with.
 */
function applyToRequest(request: NextRequest, cookies: ParsedSetCookie[]) {
  for (const cookie of cookies) {
    if (isCookieRemoval(cookie)) {
      request.cookies.delete(cookie.name);
    } else {
      request.cookies.set(cookie.name, cookie.value);
    }
  }
}

function applyToResponse(response: NextResponse, cookies: ParsedSetCookie[]) {
  for (const cookie of cookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
}

/** An outage is not a sign-out: no redirect to /login, and no cookie is touched. */
function serviceUnavailable() {
  return new NextResponse("The service is temporarily unavailable. Please try again.", {
    status: 503,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "retry-after": "30",
    },
  });
}

/**
 * Runs on every page: sets this request's Content-Security-Policy nonce (Next reads it
 * from the request header and stamps it on its own scripts), keeps the Supabase session
 * fresh, then applies the role guards to the dashboard and the brief form.
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

  const guarded = isGuardedPath(request.nextUrl.pathname);
  const hasSession = request.cookies.getAll().some(({ name }) => AUTH_COOKIE.test(name));
  let response: NextResponse;

  if (!guarded && !hasSession) {
    response = NextResponse.next({ request: forwarded });
  } else {
    const check = await readSession(forwarded);

    if (!check.ok) {
      response = guarded ? serviceUnavailable() : NextResponse.next({ request: forwarded });
    } else {
      // Before NextResponse.next, which reads the request's headers.
      applyToRequest(forwarded, check.cookies);
      response = guarded ? guardRoute(forwarded, check.session) : NextResponse.next({ request: forwarded });
      applyToResponse(response, check.cookies);
    }
  }

  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  return response;
}

function redirectTo(request: NextRequest, pathname: string) {
  return NextResponse.redirect(new URL(pathname, request.url));
}

function guardRoute(request: NextRequest, session: SessionState) {
  // The backend returns null for a signed-out visitor and for a disabled account,
  // which it has already signed out.
  if (!session) {
    return redirectTo(request, "/login");
  }

  const role = session.role;

  if (!role || !isAppRole(role)) {
    return redirectTo(request, "/login");
  }

  const pathname = request.nextUrl.pathname;
  const expectedDashboardPath = getDashboardPath(role);

  if (pathname === "/dashboard") {
    return redirectTo(request, expectedDashboardPath);
  }

  if (pathname.startsWith("/oglasi/novi")) {
    if (role !== "client") {
      return redirectTo(request, role === "provider" ? "/oglasi" : expectedDashboardPath);
    }
  }

  if (pathname.startsWith("/dashboard/client") && role !== "client") {
    return redirectTo(request, expectedDashboardPath);
  }

  if (pathname.startsWith("/dashboard/provider") && role !== "provider") {
    return redirectTo(request, expectedDashboardPath);
  }

  if (pathname.startsWith("/dashboard/admin") && role !== "admin") {
    return redirectTo(request, expectedDashboardPath);
  }

  return NextResponse.next({ request });
}

export const config = {
  // Every page, so each gets the CSP. Static files and API routes (JSON, no scripts) skip it.
  // Prefetches are not skipped: they must pass the dashboard guards too.
  matcher: ["/((?!api/|_next/static|_next/image|images/|icons/|favicon.ico|manifest.webmanifest).*)"],
};
