"use client";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section role="alert" className="space-y-3 border-t border-line py-8">
      <h1 className="text-xl font-semibold text-black">Admin data could not be loaded</h1>
      <p className="text-sm text-secondary">Check the connection and try again.</p>
      <button type="button" onClick={reset} className="min-h-11 rounded-md bg-violet-700 px-4 text-sm font-semibold text-white">Try again</button>
    </section>
  );
}
