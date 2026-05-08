import { NextResponse, type NextRequest } from "next/server";
import { getDashboardPathForRole } from "@/lib/auth/profile-completion";
import { isAppRole } from "@/lib/auth/roles";
import { hasSupabaseEnv } from "@/lib/supabase/env";
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

export async function proxy(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.next();
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

  const pathname = request.nextUrl.pathname;
  const expectedDashboardPath = getDashboardPathForRole(profile.role);

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
  matcher: ["/dashboard/:path*", "/oglasi/novi/:path*"],
};
