import { BackendOnlyShell } from "@/components/navigation/backend-only-shell";

export default async function ClientOnboardingPage() {
  return (
    <BackendOnlyShell
      eyebrow="Client Onboarding Disabled"
      title="Client onboarding UI je uklonjen."
      description="Backend model za klijenta ostaje u radu, ali forma i korisnicki tok su namerno sklonjeni dok ne zakljucamo ceo domen."
    />
  );
}
