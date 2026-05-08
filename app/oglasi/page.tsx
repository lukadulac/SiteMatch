import { BackendOnlyShell } from "@/components/navigation/backend-only-shell";

export default async function ListingsPage() {
  return (
    <BackendOnlyShell
      eyebrow="Listings Disabled"
      title="Oglasi nisu dostupni."
      description="Marketplace i listing UI su uklonjeni dok ne zavrsimo backend za projekte, statuse, filtere i autorizaciju."
    />
  );
}
