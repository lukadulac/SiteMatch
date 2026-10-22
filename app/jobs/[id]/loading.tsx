export default function JobDetailsLoading() {
	return (
		<div className="py-2" aria-busy="true" aria-label="Loading project brief">
			<div className="h-4 w-40 animate-pulse rounded-full bg-white/70" />
			<div className="mt-6 h-10 w-3/4 max-w-3xl animate-pulse rounded-2xl bg-white/70" />
			<div className="mt-7 grid gap-4 sm:grid-cols-3">
				{Array.from({ length: 3 }, (_, index) => (
					<div key={index} className="h-21 animate-pulse rounded-3xl border border-line bg-white/70" />
				))}
			</div>
			<div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
				<div className="h-[640px] animate-pulse rounded-4xl border border-line bg-white/70" />
				<div className="h-[420px] animate-pulse rounded-4xl border border-line bg-white/70" />
			</div>
		</div>
	);
}
