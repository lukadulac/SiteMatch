import { AudienceSwitch, ForAudience, type Audience } from "./audience";
import { BriefMock, ServiceMock } from "./hero-mocks";
import { LandingWrap, PrimaryLink, TextLink } from "./ui";

type HeroCopy = {
	sub: string;
	cta: { href: string; label: string };
	secondary: { href: string; label: string };
};

const heroCopy: Record<Audience, HeroCopy> = {
	hiring: {
		sub: "Post what you need or book a ready-made service from independent pros — design, development, marketing, writing, video and more. Free, with zero commission.",
		cta: { href: "/register?role=client", label: "Post a project — it's free" },
		secondary: { href: "/find-talent", label: "Browse talent →" },
	},
	freelancer: {
		sub: "Publish your services, apply to real projects and keep 100% of what you earn.",
		cta: { href: "/register?role=provider", label: "Start getting clients" },
		secondary: { href: "/jobs", label: "Browse projects →" },
	},
};

const mockEntrance = "motion-safe:animate-[rise_280ms_ease-out_both]";

/** Signed-in visitors get one way back to their work instead of the sign-up buttons. */
export function LandingHero({ dashboardHref }: { dashboardHref: string | null }) {
	return (
		<section aria-labelledby="hero-heading" className="relative overflow-hidden">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute top-85 -right-42 size-125 bg-[radial-gradient(closest-side,rgba(168,85,247,0.16),rgba(236,72,153,0.06)_60%,transparent)] md:-top-8 md:-right-25 md:size-205"
			/>
			<LandingWrap className="relative grid items-center gap-6 pt-2 pb-12 md:gap-10 md:pt-10 md:pb-20 xl:grid-cols-2 xl:gap-16">
				<div className="flex flex-col gap-4 max-md:items-stretch md:items-start md:gap-6">
					<AudienceSwitch />
					<h1
						id="hero-heading"
						className="text-[2.375rem] leading-[1.08] font-bold tracking-[-0.025em] text-[#111] md:text-[3.5rem] md:leading-[1.04] md:tracking-[-0.03em] xl:text-[4.25rem]"
					>
						The freelance marketplace with <span className="brand-text-underline">0% commission.</span>
					</h1>

					{(Object.keys(heroCopy) as Audience[]).map((audience) => {
						const copy = heroCopy[audience];
						const cta = dashboardHref ? { href: dashboardHref, label: "Go to your dashboard" } : copy.cta;

						return (
							<ForAudience key={audience} audience={audience} className="flex flex-col gap-4 md:gap-6">
								<p className="max-w-135 text-base leading-normal text-secondary md:text-[19px] md:leading-[1.55]">
									{copy.sub}
								</p>
								<div className="flex flex-col gap-1 md:items-start md:gap-2.5">
									<div className="flex flex-col md:flex-row md:flex-wrap md:items-center md:gap-x-6 md:gap-y-3">
										<PrimaryLink href={cta.href} size="lg">
											{cta.label}
										</PrimaryLink>
										{dashboardHref ? null : (
											<p className="mt-2.5 text-center text-sm text-secondary md:hidden">
												0% commission · Free to join
											</p>
										)}
										<TextLink href={copy.secondary.href} className="justify-center">
											{copy.secondary.label}
										</TextLink>
									</div>
									{dashboardHref ? null : (
										<p className="text-sm text-secondary max-md:hidden">0% commission · Free to join</p>
									)}
								</div>
							</ForAudience>
						);
					})}
				</div>

				<div>
					<ForAudience audience="hiring" className={mockEntrance}>
						<BriefMock />
					</ForAudience>
					<ForAudience audience="freelancer" className={mockEntrance}>
						<ServiceMock />
					</ForAudience>
				</div>
			</LandingWrap>
		</section>
	);
}
