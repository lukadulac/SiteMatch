import { BackendOnlyShell } from "@/components/navigation/backend-only-shell";

export default async function RegisterPage() {
  return (
    <BackendOnlyShell
      eyebrow="Register Disabled"
      title="Registracija je privremeno iskljucena."
      description="Ne zelimo polovicne forme ni aktivan user flow dok ne zakljucamo backend. Stranica ostaje ugasena do sledece faze."
    />
  );
}
