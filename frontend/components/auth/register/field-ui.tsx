import type { ReactNode } from "react";
import type { RegisterFieldErrors } from "@/components/auth/register/RegisterForm";

export function fieldError(errors: RegisterFieldErrors | undefined, name: string) {
  return errors?.[name]?.[0];
}

export function fieldClass(error?: string) {
  return `min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-sm text-black outline-none transition focus:ring-2 ${
    error
      ? "border-red-600 focus:border-red-600 focus:ring-red-100"
      : "border-zinc-300 focus:border-black focus:ring-zinc-200"
  }`;
}

export function FieldLabel({
  htmlFor,
  required = false,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-sm font-medium text-black">
      <span>{children}</span>
      <span className={required ? "text-xs font-semibold text-red-700" : "text-xs font-normal text-secondary"}>
        {required ? "Required" : "Optional"}
      </span>
    </label>
  );
}

export function FieldError({
  name,
  errors,
}: {
  name: string;
  errors?: RegisterFieldErrors;
}) {
  const error = fieldError(errors, name);
  return error ? (
    <p id={`${name}-error`} className="text-sm font-medium text-red-700">
      {error}
    </p>
  ) : null;
}
