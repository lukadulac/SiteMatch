import Link from "next/link";
import { Info } from "lucide-react";
import {
	openProviderApplicationConversationAction,
	withdrawProviderApplicationFromJobAction,
} from "@/app/jobs/actions";
import { ProviderApplicationForm } from "@/components/projects/provider-application-form";
import {
	canMessageForApplicationStatus,
	canWithdrawForApplicationStatus,
	getApplicationStatusMeta,
	type ApplicationStatus,
} from "@/lib/projects/application-status";
import { applicationStatusClasses, formatDate, formatMoney, providerStatusCopy } from "./format";

export const primaryButtonClass =
	"inline-flex min-h-13 w-full items-center justify-center rounded-2xl bg-linear-to-br from-violet-500 to-pink-500 px-5 text-base font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

const cardClass = "rounded-4xl border border-line bg-panel p-6 shadow-sm";

export type ProviderApplication = {
	id: string;
	status: ApplicationStatus;
	proposed_price: number | null;
	estimated_delivery_days: number | null;
	created_at: string;
};

export type ProposalViewer =
	| { kind: "visitor"; loginHref: string }
	| { kind: "client"; dashboardHref: string | null }
	| { kind: "provider"; application: ProviderApplication | null };

const messagingNote =
	"Messaging opens after you submit a proposal, so every conversation stays tied to this brief.";

function VisitorCard({ loginHref }: { loginHref: string }) {
	return (
		<section aria-labelledby="proposal-heading" className={cardClass}>
			<h2 id="proposal-heading" className="text-xl font-semibold text-foreground">
				Interested in this project?
			</h2>
			<p className="mt-1.5 text-sm leading-relaxed text-secondary">
				Create a free provider account to send the client a proposal.
			</p>
			<Link href="/register" className={`${primaryButtonClass} mt-5`}>
				Sign up to apply
			</Link>
			<p className="mt-3.5 text-center text-sm text-secondary">
				Already have an account?{" "}
				<Link href={loginHref} className="font-semibold text-foreground underline underline-offset-4">
					Log in
				</Link>
			</p>
		</section>
	);
}

function ClientCard({ dashboardHref }: { dashboardHref: string | null }) {
	return (
		<section aria-labelledby="proposal-heading" className={cardClass}>
			<div className="flex items-start gap-3.5">
				<span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-line bg-panel-soft">
					<Info aria-hidden="true" className="size-4.5 text-secondary" strokeWidth={1.8} />
				</span>
				<div>
					<h2 id="proposal-heading" className="text-lg font-semibold text-foreground">
						Only providers can apply
					</h2>
					<p className="mt-1.5 text-sm leading-relaxed text-secondary">
						You&apos;re signed in with a client account. Manage your own briefs and the proposals
						you&apos;ve received from your dashboard.
					</p>
				</div>
			</div>
			{dashboardHref ? (
				<Link
					href={dashboardHref}
					className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-line-strong bg-white px-5 text-[0.9375rem] font-semibold text-foreground transition hover:bg-panel-soft"
				>
					Go to dashboard
				</Link>
			) : null}
		</section>
	);
}

function AppliedCard({ projectId, application }: { projectId: string; application: ProviderApplication }) {
	const { label } = getApplicationStatusMeta(application.status);
	const facts = [
		{
			label: "Your price",
			value: application.proposed_price != null ? formatMoney(application.proposed_price) : "Open",
		},
		{
			label: "Delivery",
			value:
				application.estimated_delivery_days != null
					? `${application.estimated_delivery_days} days`
					: "Flexible",
		},
		{ label: "Submitted", value: formatDate(application.created_at) ?? "—" },
	];
	const canMessage = canMessageForApplicationStatus(application.status);
	const canWithdraw = canWithdrawForApplicationStatus(application.status);

	return (
		<section aria-labelledby="proposal-heading" className={cardClass}>
			<div className="flex items-center justify-between gap-3">
				<h2 id="proposal-heading" className="text-xl font-semibold text-foreground">
					Your proposal
				</h2>
				<span
					className={`rounded-full px-3 py-1.5 text-sm font-semibold ${applicationStatusClasses[application.status]}`}
				>
					{label}
				</span>
			</div>
			<p className="mt-2 text-sm leading-relaxed text-secondary">
				{providerStatusCopy[application.status]}
			</p>
			<dl className="mt-5 grid grid-cols-3 gap-2.5">
				{facts.map((fact) => (
					<div key={fact.label} className="rounded-2xl bg-panel-soft px-3.5 py-3">
						<dt className="text-xs text-secondary">{fact.label}</dt>
						<dd className="mt-1 text-[0.9375rem] font-semibold text-foreground">{fact.value}</dd>
					</div>
				))}
			</dl>
			{canMessage ? (
				<form action={openProviderApplicationConversationAction.bind(null, projectId, application.id)}>
					<button
						type="submit"
						className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-accent px-5 text-base font-semibold text-accent-ink transition hover:bg-accent-strong"
					>
						Message client
					</button>
				</form>
			) : null}
			{canWithdraw ? (
				<form action={withdrawProviderApplicationFromJobAction.bind(null, projectId, application.id)}>
					<button
						type="submit"
						className="mt-1.5 min-h-11 w-full text-sm font-semibold text-red-700 hover:text-red-800"
					>
						Withdraw proposal
					</button>
				</form>
			) : null}
			{!canMessage && !canWithdraw ? (
				<p className="mt-5 rounded-2xl bg-panel-soft p-4 text-sm leading-relaxed text-secondary">
					This proposal is closed. Any earlier conversation stays in your messages.
				</p>
			) : null}
		</section>
	);
}

function ProviderFormCard({ projectId }: { projectId: string }) {
	return (
		<section aria-labelledby="proposal-heading" className={cardClass}>
			<h2 id="proposal-heading" className="text-xl font-semibold text-foreground">
				Send a proposal
			</h2>
			<p className="mt-1.5 text-sm leading-relaxed text-secondary">
				Tell the client how you&apos;d approach it. You can message them once it&apos;s sent.
			</p>
			<div className="mt-5">
				<ProviderApplicationForm projectId={projectId} />
			</div>
		</section>
	);
}

export function ProposalPanel({ projectId, viewer }: { projectId: string; viewer: ProposalViewer }) {
	if (viewer.kind === "client") {
		return <ClientCard dashboardHref={viewer.dashboardHref} />;
	}

	return (
		<div className="space-y-3">
			{viewer.kind === "visitor" ? (
				<VisitorCard loginHref={viewer.loginHref} />
			) : viewer.application ? (
				<AppliedCard projectId={projectId} application={viewer.application} />
			) : (
				<ProviderFormCard projectId={projectId} />
			)}
			{viewer.kind === "provider" && viewer.application ? null : (
				<p className="px-1.5 text-sm leading-relaxed text-secondary">{messagingNote}</p>
			)}
		</div>
	);
}
