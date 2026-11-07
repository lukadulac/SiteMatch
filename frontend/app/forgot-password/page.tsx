import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getVerificationReturnPath } from "@/lib/auth/email-verification";

export default async function ForgotPasswordPage({ searchParams }: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  return <ForgotPasswordForm next={getVerificationReturnPath(params.next)} invalidLink={params.error === "link"} />;
}
