import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getVerificationReturnPath } from "@/lib/contracts/auth/email-verification";
import { RECOVERY_COOKIE } from "@/lib/auth/recovery-cookie";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Choose a new password", robots: { index: false } };

/** Only reachable from a reset link: /auth/recovery sets the marker for the recovering user. */
export default async function ResetPasswordPage({ searchParams }: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const marker = (await cookies()).get(RECOVERY_COOKIE)?.value;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !marker || marker !== user.id) {
    redirect("/forgot-password?error=link");
  }

  return <ResetPasswordForm next={getVerificationReturnPath(params.next)} />;
}
