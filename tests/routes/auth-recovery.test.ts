import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/auth/recovery/route";
import { createSupabaseServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
const TOKEN = "a".repeat(64);
const verifyOtp = vi.fn();
const signOut = vi.fn();

beforeEach(() => {
  verifyOtp.mockReset().mockResolvedValue({ data: { user: { id: "user-1" }, session: { access_token: "secret" } }, error: null });
  signOut.mockReset().mockResolvedValue({ error: null });
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { verifyOtp, signOut } } as never);
});

function recover(query: string) {
  return GET(new NextRequest(`https://staging.example.com/auth/recovery?${query}`));
}

describe("GET /auth/recovery", () => {
  it("verifies a recovery token, keeps the session and opens the reset form", async () => {
    const response = await recover(`next=%2Fjobs%2F123&token_hash=${TOKEN}&type=recovery`);

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: TOKEN, type: "recovery" });
    expect(signOut).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://staging.example.com/reset-password?next=%2Fjobs%2F123#");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");

    const marker = response.cookies.get("wb_recovery");
    expect(marker?.value).toBe("user-1");
    expect(marker?.httpOnly).toBe(true);
    expect(marker?.path).toBe("/reset-password");
  });

  it("drops an unsafe next", async () => {
    const response = await recover(`next=https%3A%2F%2Fevil.com&token_hash=${TOKEN}&type=recovery`);

    expect(response.headers.get("location")).toBe("https://staging.example.com/reset-password#");
  });

  it.each([
    ["a signup token", `token_hash=${TOKEN}&type=signup`],
    ["a missing type", `token_hash=${TOKEN}`],
    ["a missing token", "type=recovery"],
    ["a malformed token", "token_hash=bad%20token&type=recovery"],
    ["a PKCE code", "code=abc&type=recovery"],
    ["an error from Supabase", `token_hash=${TOKEN}&type=recovery&error=access_denied`],
  ])("sends %s back to forgot-password without verifying", async (_label, query) => {
    const response = await recover(query);

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://staging.example.com/forgot-password?error=link#");
    expect(response.cookies.get("wb_recovery")).toBeUndefined();
  });

  it("sends an expired or used link back to forgot-password", async () => {
    verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: { code: "otp_expired" } });

    const response = await recover(`token_hash=${TOKEN}&type=recovery`);

    expect(response.headers.get("location")).toBe("https://staging.example.com/forgot-password?error=link#");
    expect(response.cookies.get("wb_recovery")).toBeUndefined();
  });
});
