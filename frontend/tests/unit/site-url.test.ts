import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthSiteOrigin, getEmailConfirmationUrl, getPasswordRecoveryUrl } from "@/lib/auth/site-url";

afterEach(() => vi.unstubAllEnvs());

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

  it("uses the production domain, not the deployment URL, on Vercel production", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_URL", "workbridge-abc123.vercel.app");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "workbridge.com");
    expect(getAuthSiteOrigin()).toBe("https://workbridge.com");
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
