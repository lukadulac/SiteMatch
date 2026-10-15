import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { getVerificationReturnPath } from "@/lib/auth/email-verification";

export default async function VerifyEmailPage({ searchParams }: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  return <VerifyEmailForm next={getVerificationReturnPath(params.next)} invalidLink={params.error === "confirmation"} />;
}
