import Link from "next/link";
import { Package } from "lucide-react";
import {
	formatProviderServicePrice,
	getCategoryLabel,
} from "@/lib/provider-services/formatters";
import type { PublicProviderServiceListing } from "@/lib/provider-services/service";
import { LandingSection, PrimaryLink, SectionHeading, TextLink, cardClass } from "./ui";

/** The row holds four cards; with fewer, the invitation fills the empty columns. */
export const RECENT_SERVICES_LIMIT = 4;

const inviteSpan: Record<number, string> = {
	0: "md:col-span-2 xl:col-span-4",
	1: "md:col-span-2 xl:col-span-3",
	2: "md:col-span-2 xl:col-span-2",
	3: "md:col-span-2 xl:col-span-1",
};

/**
 * Live services, newest first. Fewer than four (or a failed load, which arrives as an
 * empty list) adds a card that invites the first freelancers instead of showing gaps.
 */
export function LandingRecentServices({
	services,
	signedIn,
}: {
	services: PublicProviderServiceListing[];
	signedIn: boolean;
}) {
	const shown = services.slice(0, RECENT_SERVICES_LIMIT);

	return (
		<LandingSection labelledBy="services-heading">
			<div className="mb-7 flex flex-wrap items-end justify-between gap-4 md:mb-11">
				<SectionHeading id="services-heading">Recently published services</SectionHeading>
				{shown.length > 0 ? <TextLink href="/find-talent">Browse talent →</TextLink> : null}
			</div>
			<ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{shown.map((service) => (
					<li key={service.id} className="grid min-w-0">
						<ServiceCard service={service} />
					</li>
				))}
				{shown.length < RECENT_SERVICES_LIMIT ? (
					<li className={`grid min-w-0 ${inviteSpan[shown.length]}`}>
						<div className="flex flex-col items-start justify-center gap-3.5 rounded-2xl border border-dashed border-line-strong p-5.5 md:p-7">
							<h3 className="text-2xl leading-tight font-bold tracking-[-0.01em]">
								Be one of the first freelancers on WorkBridge
							</h3>
							<p className="text-[17px] text-secondary">
								Publish a service and it can appear right here. Free to join, with 0% commission.
							</p>
							{signedIn ? null : (
								<PrimaryLink href="/register?role=provider" className="max-md:w-full">
									Start getting clients
								</PrimaryLink>
							)}
						</div>
					</li>
				) : null}
			</ul>
		</LandingSection>
	);
}

function ServiceCard({ service }: { service: PublicProviderServiceListing }) {
	return (
		<Link
			href={`/find-talent/${service.id}`}
			className={`${cardClass} brand-hover-border flex min-w-0 flex-col gap-3 p-3 pb-5 transition focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2`}
		>
			<span
				aria-hidden="true"
				className="grid h-28 place-items-center rounded-[10px] bg-linear-135 from-violet-200 to-pink-200 text-violet-700 md:h-33"
			>
				<Package className="size-7" strokeWidth={1.6} />
			</span>
			<span className="flex flex-1 flex-col gap-2 px-2">
				<span className="text-[13px] font-bold text-secondary">{getCategoryLabel(service)}</span>
				<span className="text-lg leading-tight font-bold break-words text-[#111]">{service.title}</span>
				{service.provider?.full_name ? (
					<span className="text-sm text-secondary">{service.provider.full_name}</span>
				) : null}
				<span className="mt-auto pt-2 text-[15px] font-bold text-[#111]">
					{formatProviderServicePrice(service)}
				</span>
			</span>
		</Link>
	);
}
