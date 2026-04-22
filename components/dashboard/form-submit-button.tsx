"use client";

import { useFormStatus } from "react-dom";

type FormSubmitButtonProps = {
  idleLabel: string;
  pendingLabel: string;
};

export function FormSubmitButton({
  idleLabel,
  pendingLabel,
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-ink shadow-[0_18px_40px_rgba(20,168,0,0.24)] transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
