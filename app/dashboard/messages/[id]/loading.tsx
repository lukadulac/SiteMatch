export default function MessageThreadLoading() {
  return (
    <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="h-72 rounded-4xl border border-line bg-white/70" />
      <div className="space-y-6">
        <div className="h-40 rounded-4xl border border-line bg-white/70" />
        <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.4fr)]">
          <div className="h-[520px] rounded-4xl border border-line bg-white/70" />
          <div className="h-[680px] rounded-4xl border border-line bg-white/70" />
        </div>
      </div>
    </div>
  );
}
