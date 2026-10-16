import { afterEach, describe, expect, it, vi } from "vitest";
import { getForgotPasswordHref, getRegistrationHref, getVerificationHref, getVerificationReturnPath } from "@/lib/auth/email-verification";
import { getAuthSiteOrigin, getEmailConfirmationUrl, getPasswordRecoveryUrl } from "@/lib/auth/site-url";

afterEach(() => vi.unstubAllEnvs());

describe("verification return paths", () => {
  it("preserves local destinations and rejects external URLs and auth loops", () => {
    expect(getVerificationReturnPath("/jobs/123?tab=details#brief")).toBe("/jobs/123?tab=details#brief");
    for (const value of ["//evil.com", "https://evil.com", "/auth/confirm", "/auth/confirm?next=/jobs", "/verify-email", "/register", "/%61uth/confirm", "/x%2f..%2fauth%2fconfirm", "/login", "/forgot-password", "/reset-password", null]) {
      expect(getVerificationReturnPath(value), String(value)).toBeNull();
    }
  });

  it("generates links with only sanitized next values", () => {
    expect(getVerificationHref("/jobs/123")).toBe("/verify-email?next=%2Fjobs%2F123");
    expect(getRegistrationHref("/jobs/123")).toBe("/register?next=%2Fjobs%2F123");
    expect(getVerificationHref("//evil.com")).toBe("/verify-email");
    expect(getForgotPasswordHref("/jobs/123")).toBe("/forgot-password?next=%2Fjobs%2F123");
    expect(getForgotPasswordHref("//evil.com")).toBe("/forgot-password");
  });
});

describe("email confirmation origin", () => {
  it("uses a configured origin and preserves a safe next path", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://staging.example.com");
    expect(getEmailConfirmationUrl("/jobs/123")).toBe("https://staging.example.com/auth/confirm?next=%2Fjobs%2F123");
    expect(getEmailConfirmationUrl("https://evil.com")).toBe("https://staging.example.com/auth/confirm?next=");
  });

  it("builds the password recovery callback URL the same way", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://staging.example.com");
    expect(getPasswordRecoveryUrl("/jobs/123")).toBe("https://staging.example.com/auth/recovery?next=%2Fjobs%2F123");
    expect(getPasswordRecoveryUrl("/auth/confirm")).toBe("https://staging.example.com/auth/recovery?next=");
  });

  it("uses the Vercel deployment URL when no explicit origin exists", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_URL", "staging.vercel.app");
    expect(getAuthSiteOrigin()).toBe("https://staging.vercel.app");
  });

  it("fails closed in production without a configured deployment origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getAuthSiteOrigin()).toThrow();
  });

  it("rejects unsafe origins and permits localhost development", () => {
    for (const origin of ["javascript:alert(1)", "http://example.com", "https://user:pass@example.com", "https://example.com/path", "https://example.com?next=evil"]) {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin);
      expect(() => getAuthSiteOrigin()).toThrow();
    }
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    expect(getAuthSiteOrigin()).toBe("http://localhost:3000");
  });
});
