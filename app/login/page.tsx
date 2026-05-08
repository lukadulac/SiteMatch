import { BackendOnlyShell } from "@/components/navigation/backend-only-shell";

export default async function LoginPage() {
  return (
    <BackendOnlyShell
      eyebrow="Login Disabled"
      title="Prijava je privremeno iskljucena."
      description="Sav aktivni frontend je uklonjen dok ne zavrsimo backend domen i pravila. Auth UI ce biti vracen kasnije kroz novi interfejs."
    />
  );
}
