import { describe, expect, it } from "vitest";
import { getForgotPasswordHref, getRegistrationHref, getVerificationHref, getVerificationReturnPath } from "../../src/contracts/auth/email-verification.js";

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
