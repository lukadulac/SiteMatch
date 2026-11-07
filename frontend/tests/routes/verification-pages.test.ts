import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import VerifyEmailPage from "@/app/verify-email/page";
import LoginPage from "@/app/login/page";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

vi.mock("@/app/(auth)/actions", () => ({ loginAction: vi.fn() }));
vi.mock("@/app/(auth)/verification-actions", () => ({ resendConfirmationAction: vi.fn() }));

describe("email verification pages", () => {
  it("renders a recovery form with a preserved local login destination", async () => {
    const html = renderToStaticMarkup(await VerifyEmailPage({ searchParams: Promise.resolve({ next: "/jobs/123", error: "confirmation" }) }));
    expect(html).toContain("This link could not be completed");
    expect(html).toContain('href="/login?next=%2Fjobs%2F123"');
    expect(html).toContain('name="email"');
    expect(html).toContain('type="email"');
  });

  it("does not render arbitrary error text, external next paths or array parameters", async () => {
    for (const next of ["https://evil.com", ["/jobs/123", "//evil.com"]]) {
      const html = renderToStaticMarkup(await VerifyEmailPage({ searchParams: Promise.resolve({ next, error: "private-provider-error" }) }));
      expect(html).not.toContain("evil.com");
      expect(html).not.toContain("private-provider-error");
      expect(html).toContain('href="/login"');
    }
  });

  it("renders the post-signup state with a resend cooldown and no signup form", () => {
    const html = renderToStaticMarkup(createElement(VerifyEmailForm, { email: "ana@example.com", registered: true, next: "/jobs/123" }));
    expect(html).toContain("Check your inbox");
    expect(html).toContain("Resend available in 60s");
    expect(html).toContain('value="ana@example.com"');
    expect(html).not.toContain('name="password"');
  });

  it("renders confirmation feedback while preserving resend and registration destinations", async () => {
    const html = renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({ next: "/jobs/123", confirmed: "1" }) }));
    expect(html).toContain("Your email is confirmed");
    expect(html).toContain('href="/verify-email?next=%2Fjobs%2F123"');
    expect(html).toContain('href="/register?next=%2Fjobs%2F123"');
  });
});
