import RegisterForm from "@/components/auth/register/RegisterForm";
import { getVerificationReturnPath } from "@/lib/auth/email-verification";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const params = await searchParams;
  return (
    <section>
      <RegisterForm next={getVerificationReturnPath(params.next)} />
    </section>
  );
}
