import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/auth/confirm/route";
import { createSupabaseServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
const TOKEN = "a".repeat(64);
const result = () => ({ data: { user: { email_confirmed_at: "2026-10-15T12:00:00Z" }, session: { access_token: "secret" } }, error: null });
const verifyOtp = vi.fn();
const exchangeCodeForSession = vi.fn();
const signOut = vi.fn();

beforeEach(() => {
  verifyOtp.mockResolvedValue(result());
  exchangeCodeForSession.mockResolvedValue(result());
  signOut.mockResolvedValue({ error: null });
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { verifyOtp, exchangeCodeForSession, signOut } } as never);
});

function confirm(query: string) {
  return GET(new NextRequest(`https://staging.example.com/auth/confirm?${query}`));
}

describe("GET /auth/confirm", () => {
  it("verifies a signup token, ends only the local session and returns to login", async () => {
    const response = await confirm(`token_hash=${TOKEN}&type=signup&next=%2Fjobs%2F123`);
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: TOKEN, type: "signup" });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.headers.get("location")).toBe("https://staging.example.com/login?next=%2Fjobs%2F123&confirmed=1#");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("supports the current Supabase ConfirmationURL through PKCE", async () => {
    const response = await confirm("code=valid-code");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("valid-code");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://staging.example.com/login?confirmed=1#");
  });

  it("accepts signup type but rejects recovery and change-email types", async () => {
    await confirm(`token_hash=${TOKEN}&type=signup`);
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: TOKEN, type: "signup" });
    verifyOtp.mockClear();
    for (const type of ["email", "recovery", "email_change", "magiclink", "sms"]) {
      const response = await confirm(`token_hash=${TOKEN}&type=${type}`);
      expect(response.headers.get("location")).toContain("/verify-email?error=confirmation");
    }
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("accepts variable-length and PKCE-prefixed signup tokens", async () => {
    for (const token of ["b".repeat(56), `pkce_${"c".repeat(56)}`]) {
      const response = await confirm(`token_hash=${token}&type=signup`);
      expect(verifyOtp).toHaveBeenCalledWith({ token_hash: token, type: "signup" });
      expect(response.headers.get("location")).toContain("/login?confirmed=1#");
    }
  });

  it("rejects malformed, missing, ambiguous and error parameters without touching auth", async () => {
    for (const query of ["", "token_hash=bad%20token&type=signup", `token_hash=${TOKEN}`, `code=one&token_hash=${TOKEN}&type=signup`, "error=access_denied&code=one", "code=one&type=recovery"]) {
      const response = await confirm(query);
      expect(response.headers.get("location")).toContain("/verify-email?error=confirmation");
    }
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("does not forward external next URLs or token/error details", async () => {
    const response = await confirm("code=one&next=https%3A%2F%2Fevil.com");
    expect(response.headers.get("location")).toBe("https://staging.example.com/login?confirmed=1#");
    exchangeCodeForSession.mockResolvedValue({ data: { user: null, session: null }, error: { message: "private provider error" } });
    const failure = await confirm(`code=used-secret&next=%2Fjobs%2F123`);
    expect(failure.headers.get("location")).toBe("https://staging.example.com/verify-email?next=%2Fjobs%2F123&error=confirmation#");
  });

  it("handles expired/used tokens without issuing a session", async () => {
    verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: { message: "expired" } });
    const response = await confirm(`token_hash=${TOKEN}&type=signup`);
    expect(response.headers.get("location")).toContain("/verify-email?error=confirmation");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("clears an unverified or recovery session instead of treating it as confirmation", async () => {
    for (const data of [
      { user: {}, session: {} },
      { user: { email_confirmed_at: "2026-10-15" }, session: {}, redirectType: "recovery" },
    ]) {
      exchangeCodeForSession.mockResolvedValue({ data, error: null });
      expect((await confirm("code=one")).headers.get("location")).toContain("/verify-email?error=confirmation");
    }
    expect(signOut).toHaveBeenCalledTimes(2);
  });

  it("handles provider exceptions and local sign-out errors without leaking them", async () => {
    exchangeCodeForSession.mockRejectedValueOnce(new Error("private failure"));
    expect((await confirm("code=one")).headers.get("location")).toContain("/verify-email?error=confirmation");
    signOut.mockResolvedValue({ error: { message: "sign out failed" } });
    expect((await confirm("code=two")).headers.get("location")).toContain("/verify-email?error=confirmation");
  });
});
