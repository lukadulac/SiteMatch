import { BackendOnlyShell } from "@/components/navigation/backend-only-shell";

export default async function DashboardPage() {
  return (
    <BackendOnlyShell
      eyebrow="Dashboard Disabled"
      title="Dashboard je privremeno sklonjen."
      description="Postojeci dashboard tokovi i edit forme su uklonjeni iz upotrebe dok backend ne bude kompletan."
    />
  );
}
