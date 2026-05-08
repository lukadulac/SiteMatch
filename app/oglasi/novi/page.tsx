import { BackendOnlyShell } from "@/components/navigation/backend-only-shell";

export default async function NewListingPage() {
  return (
    <BackendOnlyShell
      eyebrow="New Listing Disabled"
      title="Kreiranje oglasa je iskljuceno."
      description="Create listing UI ostaje ugasen dok ne zavrsimo backend za projects domen i novi frontend pristup."
    />
  );
}
