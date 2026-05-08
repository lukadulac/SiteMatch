import { BackendOnlyShell } from "@/components/navigation/backend-only-shell";

export default async function AdminDashboardPage() {
  return (
    <BackendOnlyShell
      eyebrow="Admin Dashboard Disabled"
      title="Admin UI je ugasen."
      description="Ceo admin frontend je uklonjen iz upotrebe dok traje backend-first razvoj."
    />
  );
}
