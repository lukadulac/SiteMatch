import type { Metadata } from "next";
import { AudienceProvider } from "@/components/landing/audience";
import { LandingFinalCta, LandingFooter } from "@/components/landing/closing-sections";
import { LandingHero } from "@/components/landing/hero";
import { LandingHowItWorks } from "@/components/landing/how-it-works";
import { LandingCategories, LandingWhy } from "@/components/landing/marketplace-sections";
import { LandingRecentServices, RECENT_SERVICES_LIMIT } from "@/components/landing/recent-services";
import {
	LandingComparison,
	LandingFaq,
	LandingFounderNote,
	type Founder,
} from "@/components/landing/trust-sections";
import { LandingWorkroomShowcase } from "@/components/landing/workroom-showcase";
import { getCurrentHeaderState } from "@/lib/navigation/current-header-state";
import { getPublicPublishedProviderServices } from "@/lib/provider-services/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
	title: { absolute: "WorkBridge" },
	description:
		"Hire freelancers for design, development, marketing, writing, video and more, or get hired and keep 100% of what you earn. Free to join, 0% commission.",
};

// The founder note replaces testimonials at launch. It stays hidden until a real name
// (and optionally a photo in /public) is set here.
const founder: Founder | null = null;

export default async function Home() {
	const [{ user }, servicesResult] = await Promise.all([
		getCurrentHeaderState(),
		createSupabaseServerClient().then((supabase) =>
			getPublicPublishedProviderServices(supabase, {
				page: 1,
				pageSize: RECENT_SERVICES_LIMIT,
				sort: "newest",
			}),
		),
	]);
	// A failed load shows the invitation card rather than taking the homepage down.
	const services = servicesResult.data?.services ?? [];
	const dashboardHref = user?.dashboardHref ?? null;

	return (
		<AudienceProvider>
			<LandingHero dashboardHref={dashboardHref} />
			<LandingCategories />
			<LandingWhy />
			<LandingHowItWorks />
			<LandingWorkroomShowcase />
			<LandingRecentServices services={services} signedIn={Boolean(user)} />
			<LandingComparison />
			<LandingFounderNote founder={founder} />
			<LandingFaq />
			{user ? null : <LandingFinalCta />}
			<LandingFooter dashboardHref={dashboardHref} />
		</AudienceProvider>
	);
}
