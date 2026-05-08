import { BackendOnlyShell } from "@/components/navigation/backend-only-shell";

export default async function ProviderOnboardingPage() {
  return (
    <BackendOnlyShell
      eyebrow="Provider Onboarding Disabled"
      title="Provider onboarding UI je uklonjen."
      description="Provider deo ostaje backend-only dok ne definisemo kompletan data model, relacije i pravila oko capability profila."
    />
  );
}
