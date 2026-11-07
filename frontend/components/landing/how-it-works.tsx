import { AudienceTabPanel, AudienceTabs, ForAudience, type Audience } from "./audience";
import { LandingSection, SectionHeading } from "./ui";

const steps: Record<Audience, Array<{ title: string; body: string }>> = {
	hiring: [
		{
			title: "Post a brief or pick a service",
			body: "Describe the job and let freelancers come to you, or request a ready-made service.",
		},
		{
			title: "Compare freelancers and hire",
			body: "Look through profiles, chat before you decide and pick the person who fits.",
		},
		{
			title: "Work together in one place",
			body: "Keep the conversation in WorkBridge messages. A booked service also gets a shared workroom.",
		},
	],
	freelancer: [
		{
			title: "Create your profile and publish services",
			body: "Show what you do and set a price for your ready-made services.",
		},
		{
			title: "Apply to briefs or receive requests",
			body: "Find projects that fit, or let clients come to you through your services.",
		},
		{
			title: "Deliver and mark the work complete",
			body: "Keep every client conversation in one inbox and close each booked job in its workroom.",
		},
	],
};

/** The tabs follow the hero switch, so a visitor who picked a side sees their own steps. */
export function LandingHowItWorks() {
	return (
		<LandingSection id="how-it-works" labelledBy="how-heading">
			<div className="mb-7 md:mb-11">
				<SectionHeading id="how-heading">How it works</SectionHeading>
			</div>
			<AudienceTabs panelId="how-panel" />
			<AudienceTabPanel id="how-panel">
				{(Object.keys(steps) as Audience[]).map((audience) => (
					<ForAudience key={audience} audience={audience}>
						<ol className="grid md:grid-cols-3 md:gap-12">
							{steps[audience].map((step, index) => (
								<li key={step.title} className="flex flex-col gap-1.5 py-4.5 md:gap-3 md:py-0">
									<span
										aria-hidden="true"
										className="mb-3 block h-0.5 bg-linear-to-r from-violet-500 via-purple-500 to-pink-500 md:mb-5"
									/>
									<span aria-hidden="true" className="text-[15px] font-bold text-violet-700">{index + 1}</span>
									<h3 className="text-[22px] leading-tight font-bold tracking-[-0.015em] md:text-[26px]">
										{step.title}
									</h3>
									<p className="text-[17px] text-secondary">{step.body}</p>
								</li>
							))}
						</ol>
					</ForAudience>
				))}
			</AudienceTabPanel>
		</LandingSection>
	);
}
