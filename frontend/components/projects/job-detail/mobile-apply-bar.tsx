/**
 * Keeps the budget and the way to apply in reach on small screens, where the
 * proposal card sits below the whole brief.
 */
export function MobileApplyBar({ budget, label }: { budget: string; label: string }) {
	return (
		<div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line bg-panel px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(17,17,17,0.05)] lg:hidden">
			<div className="min-w-0 flex-1">
				<p className="text-xs text-secondary">Budget</p>
				<p className="truncate text-base font-semibold text-foreground">{budget}</p>
			</div>
			<a
				href="#apply"
				className="inline-flex min-h-12 shrink-0 items-center rounded-2xl bg-linear-to-br from-violet-500 to-pink-500 px-5 text-[0.9375rem] font-semibold text-white"
			>
				{label}
			</a>
		</div>
	);
}
