import { BackendOnlyShell } from "@/components/navigation/backend-only-shell";

export default async function ProviderDashboardPage() {
  return (
    <BackendOnlyShell
      eyebrow="Provider Dashboard Disabled"
      title="Provider dashboard je ugasen."
      description="Sve provider stranice su svedene na staticki prikaz dok ne zavrsimo backend i novi interfejs."
    />
  );
}
