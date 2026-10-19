export default function AdminLoading() {
  return (
    <div role="status" className="space-y-5" aria-label="Loading admin console">
      <div className="h-8 w-56 animate-pulse rounded-md bg-zinc-200" />
      <div className="h-28 animate-pulse rounded-md border border-line bg-white" />
      <div className="h-28 animate-pulse rounded-md border border-line bg-white" />
      <span className="sr-only">Loading admin console</span>
    </div>
  );
}
