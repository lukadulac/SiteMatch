import { BackendOnlyShell } from "@/components/navigation/backend-only-shell";

export default async function ClientDashboardPage() {
  return (
    <BackendOnlyShell
      eyebrow="Client Dashboard Disabled"
      title="Client dashboard je ugasen."
      description="Nema aktivnog profila, edit forme ni korisnickog toka dok se backend ne zavrsi do kraja."
    />
  );
}
