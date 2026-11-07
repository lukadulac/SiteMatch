import RegisterForm, { type RegisterRole } from "@/components/auth/register/RegisterForm";
import { getVerificationReturnPath } from "@/lib/contracts/auth/email-verification";

type RegisterSearchParams = { next?: string | string[]; role?: string | string[] };

/** The homepage's audience CTAs link here with ?role= so the right card starts selected. */
function readInitialRole(role: RegisterSearchParams["role"]): RegisterRole | null {
  return role === "client" || role === "provider" ? role : null;
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<RegisterSearchParams> }) {
  const params = await searchParams;
  return (
    <section>
      <RegisterForm next={getVerificationReturnPath(params.next)} initialRole={readInitialRole(params.role)} />
    </section>
  );
}
