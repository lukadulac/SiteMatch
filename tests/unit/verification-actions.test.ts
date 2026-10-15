import { beforeEach, describe, expect, it, vi } from "vitest";
import { resendConfirmationAction } from "@/app/(auth)/verification-actions";
import { initialAuthActionState } from "@/app/(auth)/action-state";
import { recordAuthRateLimitAttempt } from "@/lib/auth/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseStub } from "../helpers/supabase-stub";
import { buildFormData } from "../helpers/form-data";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.5", origin: "https://evil.com" }) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/auth/rate-limit", async () => ({
  ...await vi.importActual<typeof import("@/lib/auth/rate-limit")>("@/lib/auth/rate-limit"),
  recordAuthRateLimitAttempt: vi.fn(),
}));

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://staging.example.com");
  vi.mocked(recordAuthRateLimitAttempt).mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
});

describe("resendConfirmationAction", () => {
  it("validates input before calling Supabase", async () => {
    const result = await resendConfirmationAction(initialAuthActionState, buildFormData({ email: "bad" }));
    expect(result.fieldErrors?.email).toBeDefined();
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("resends only signup emails using the configured origin and sanitized next", async () => {
    const stub = createSupabaseStub();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);
    const result = await resendConfirmationAction(initialAuthActionState, buildFormData({ email: " ana@example.com ", next: "/jobs/123" }));
    expect(stub.callsFor("auth.resend")[0]?.payload).toEqual({
      type: "signup", email: "ana@example.com", options: { emailRedirectTo: "https://staging.example.com/auth/confirm?next=%2Fjobs%2F123" },
    });
    expect(result.resendAfter).toBeGreaterThan(Date.now());
  });

  it("returns the same response for unknown/confirmed accounts and delivery failures", async () => {
    const messages = [];
    for (const error of [null, { message: "User not found" }, { message: "Email already confirmed" }, { message: "SMTP unavailable" }]) {
      const stub = createSupabaseStub({}, { resend: { error } });
      vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);
      const result = await resendConfirmationAction(initialAuthActionState, buildFormData({ email: "ana@example.com", next: "//evil.com" }));
      messages.push(result.formSuccess);
      expect(result.formError).toBeUndefined();
      expect(stub.callsFor("auth.resend")[0]?.payload).toMatchObject({ options: { emailRedirectTo: "https://staging.example.com/auth/confirm?next=" } });
    }
    expect(new Set(messages).size).toBe(1);
  });

  it("does not send when the shared signup rate limit is reached", async () => {
    const stub = createSupabaseStub();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);
    vi.mocked(recordAuthRateLimitAttempt).mockResolvedValue({ allowed: false, retryAfterSeconds: 900 });
    const result = await resendConfirmationAction(initialAuthActionState, buildFormData({ email: "ana@example.com" }));
    expect(stub.callKeys()).not.toContain("auth.resend");
    expect(result.formSuccess).toBeDefined();
  });
});
