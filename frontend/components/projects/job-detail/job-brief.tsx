import { ArrowUpRight, Palette, PenLine, Search, type LucideIcon } from "lucide-react";
import { ExpandableText } from "./expandable-text";
import {
	providerTypeLabel,
	readinessLabel,
	scopeLabel,
	websiteHost,
} from "./format";

type JobBriefProps = {
	project: {
		description: string;
		what_do_you_need_text: string | null;
		business_context_text: string | null;
		target_audience_text: string | null;
		success_criteria_text: string | null;
		discovery_notes: string | null;
		needs_design: boolean;
		needs_seo: boolean;
		needs_content_writing: boolean;
		preferred_provider_type: string | null;
		scope_level: string | null;
		readiness_level: string | null;
		preferred_language: string | null;
		is_remote_friendly: boolean;
		existing_website_url: string | null;
		goals: { id: string; name: string }[];
		features: { id: string; name: string }[];
	};
};

function BriefSection({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className="border-t border-line pt-7 first:border-t-0 first:pt-0">
			<h2 className="mb-3.5 text-xl font-semibold text-foreground">{title}</h2>
			{children}
		</section>
	);
}

function ChipList({ items }: { items: { key: string; label: string; icon?: LucideIcon }[] }) {
	return (
		<ul className="flex flex-wrap gap-2">
			{items.map(({ key, label, icon: Icon }) => (
				<li
					key={key}
					className="flex max-w-full items-center gap-2 rounded-full border border-line bg-panel-soft px-3.5 py-2 text-sm text-foreground"
				>
					{Icon ? (
						<Icon aria-hidden="true" className="size-4 shrink-0 text-secondary" strokeWidth={1.8} />
					) : null}
					<span className="truncate">{label}</span>
				</li>
			))}
		</ul>
	);
}

function Subsection({ title, text }: { title: string; text: string | null }) {
	if (!text) {
		return null;
	}

	return (
		<>
			<h3 className="mt-5 mb-1.5 text-[0.9375rem] font-semibold text-foreground">{title}</h3>
			<p className="whitespace-pre-line wrap-break-word text-[0.9375rem] leading-relaxed text-secondary">
				{text}
			</p>
		</>
	);
}

export function JobBrief({ project }: JobBriefProps) {
	const extras = [
		project.needs_design ? { key: "design", label: "Design", icon: Palette } : null,
		project.needs_content_writing
			? { key: "content", label: "Content writing", icon: PenLine }
			: null,
		project.needs_seo ? { key: "seo", label: "SEO setup", icon: Search } : null,
	].filter((item) => item !== null);
	const host = project.existing_website_url ? websiteHost(project.existing_website_url) : null;
	// Rows with nothing to say are left out rather than printed as "Not specified".
	const idealProvider = [
		{ label: "Provider type", value: providerTypeLabel(project.preferred_provider_type) },
		{ label: "Scope", value: scopeLabel(project.scope_level) },
		{ label: "Readiness", value: readinessLabel(project.readiness_level) },
		{ label: "Language", value: project.preferred_language },
		{ label: "Remote", value: project.is_remote_friendly ? "Yes" : "On-site or hybrid" },
	].filter((row): row is { label: string; value: string } => Boolean(row.value));

	return (
		<article className="min-w-0 space-y-7 rounded-4xl border border-line bg-panel p-6 sm:p-10">
			<BriefSection title="About the project">
				<ExpandableText text={project.description} />
			</BriefSection>

			{project.what_do_you_need_text ? (
				<BriefSection title="What needs to be built">
					<p className="whitespace-pre-line wrap-break-word text-base leading-relaxed text-foreground">
						{project.what_do_you_need_text}
					</p>
					<Subsection title="Business context" text={project.business_context_text} />
					<Subsection title="Target audience" text={project.target_audience_text} />
					<Subsection title="Success criteria" text={project.success_criteria_text} />
					<Subsection title="Discovery notes" text={project.discovery_notes} />
				</BriefSection>
			) : null}

			{project.goals.length > 0 ? (
				<BriefSection title="Goals">
					<ChipList items={project.goals.map((goal) => ({ key: goal.id, label: goal.name }))} />
				</BriefSection>
			) : null}

			{project.features.length > 0 ? (
				<BriefSection title="Features">
					<ChipList
						items={project.features.map((feature) => ({ key: feature.id, label: feature.name }))}
					/>
				</BriefSection>
			) : null}

			{extras.length > 0 ? (
				<BriefSection title="Extra services needed">
					<ChipList items={extras} />
				</BriefSection>
			) : null}

			<BriefSection title="Ideal provider">
				<dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
					{idealProvider.map(({ label, value }) => (
						<div key={label} className="rounded-2xl bg-panel-soft px-4 py-3.5">
							<dt className="text-sm text-secondary">{label}</dt>
							<dd className="mt-1 text-[0.9375rem] font-semibold text-foreground">{value}</dd>
						</div>
					))}
					{project.existing_website_url && host ? (
						<div className="rounded-2xl bg-panel-soft px-4 py-3.5">
							<dt className="text-sm text-secondary">Existing website</dt>
							<dd className="mt-1 text-[0.9375rem] font-semibold text-foreground">
								<a
									href={project.existing_website_url}
									target="_blank"
									rel="noreferrer"
									className="inline-flex max-w-full items-center gap-1 underline underline-offset-4 hover:text-secondary"
								>
									<span className="truncate">{host}</span>
									<ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
									<span className="sr-only">(opens in a new tab)</span>
								</a>
							</dd>
						</div>
					) : null}
				</dl>
			</BriefSection>
		</article>
	);
}
