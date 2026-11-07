"use client";

import Link from "next/link";

type MessagesErrorProps = {
  error: Error;
  reset: () => void;
};

export default function MessagesError({ error, reset }: MessagesErrorProps) {
  return (
    <div className="rounded-4xl border border-red-200 bg-red-50 p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-red-700">
        Messages error
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-black">
        We could not load your messages.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-red-700">
        {error.message}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-2xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-red-100"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
