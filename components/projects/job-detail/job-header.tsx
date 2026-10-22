import Link from "next/link";
import { CalendarDays, CircleDollarSign, Flag, type LucideIcon } from "lucide-react";

type KeyFact = { label: string; value: string; icon: LucideIcon };

type JobHeaderProps = {
	title: string;
	status: string;
	category: string | null;
	postedAt: string | null;
	isRemoteFriendly: boolean;
	language: string | null;
	budget: string;
	deadline: string | null;
	startDate: string | null;
};

function StatusChip({ status }: { status: string }) {
	const inDiscussion = status === "in_discussion";

	return (
		<span
			className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${
				inDiscussion ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"
			}`}
		>
			<span
				aria-hidden="true"
				className={`size-2 rounded-full ${inDiscussion ? "bg-amber-500" : "bg-emerald-500"}`}
			/>
			{inDiscussion ? "In discussion" : "Open"}
		</span>
	);
}

export function JobHeader({
	title,
	status,
	category,
	postedAt,
	isRemoteFriendly,
	language,
	budget,
	deadline,
	startDate,
}: JobHeaderProps) {
	const meta = [
		postedAt ? `Posted ${postedAt}` : null,
		isRemoteFriendly ? "Remote-friendly" : null,
		language,
	].filter(Boolean);
	const facts = [
		{ label: "Budget", value: budget, icon: CircleDollarSign },
		deadline ? { label: "Deadline", value: deadline, icon: Flag } : null,
		startDate ? { label: "Start date", value: startDate, icon: CalendarDays } : null,
	].filter((fact): fact is KeyFact => fact !== null);

	return (
		<header>
			<nav aria-label="Breadcrumb" className="text-sm text-secondary">
				<ol className="flex flex-wrap items-center gap-2">
					<li>
						<Link href="/jobs" className="hover:text-foreground">
							Jobs
						</Link>
					</li>
					{category ? (
						<>
							<li aria-hidden="true">/</li>
							<li aria-current="page" className="text-foreground">
								{category}
							</li>
						</>
					) : null}
				</ol>
			</nav>

			<div className="mt-5">
				<StatusChip status={status} />
			</div>
			<h1 className="mt-4 max-w-4xl wrap-break-word text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
				{title}
			</h1>
			{meta.length > 0 ? (
				<p className="mt-3 text-[0.9375rem] text-secondary">{meta.join(" · ")}</p>
			) : null}

			<dl className="mt-7 grid gap-4 sm:grid-cols-3">
				{facts.map(({ label, value, icon: Icon }) => (
					<div
						key={label}
						className="flex items-center gap-4 rounded-3xl border border-line bg-panel px-5 py-5"
					>
						<span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-panel-soft">
							<Icon aria-hidden="true" className="size-5 text-foreground" strokeWidth={1.8} />
						</span>
						<div className="min-w-0">
							<dt className="text-sm text-secondary">{label}</dt>
							<dd className="mt-0.5 text-lg font-semibold text-foreground">{value}</dd>
						</div>
					</div>
				))}
			</dl>
		</header>
	);
}
