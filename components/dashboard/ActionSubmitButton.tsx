"use client";

import { useFormStatus } from "react-dom";

type ActionSubmitButtonProps = {
  label: string;
  pendingLabel: string;
  confirmMessage?: string;
  className: string;
};

export function ActionSubmitButton({
  label,
  pendingLabel,
  confirmMessage,
  className,
}: ActionSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      className={`${className} disabled:cursor-wait disabled:opacity-60`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
