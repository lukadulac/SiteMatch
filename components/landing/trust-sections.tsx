import { Plus } from "lucide-react";
import { LandingSection, LandingWrap, SectionHeading } from "./ui";

const comparisonRows = [
	{ feature: "Commission", us: "0%", them: "10–20%" },
	{ feature: "Joining", us: "Free", them: "Often paid bids or ‘connects’" },
	{ feature: "Payment", us: "You pay each other directly", them: "Must go through the platform" },
];

export function LandingComparison() {
	return (
		<LandingSection labelledBy="comparison-heading" tone="white">
			<div className="mb-7 md:mb-11">
				<SectionHeading id="comparison-heading">The honest comparison</SectionHeading>
			</div>
			<table className="w-full max-w-245 table-fixed border-separate border-spacing-0 text-sm md:text-lg">
				<thead>
					<tr className="text-left text-[13px] font-bold text-secondary md:text-[15px]">
						<th scope="col" className="w-[31%] border-b border-line-strong px-1.5 py-3.5 md:w-auto md:px-6 md:py-5">
							<span className="sr-only">Feature</span>
						</th>
						<th
							scope="col"
							className="relative w-[32%] overflow-hidden rounded-t-[14px] border-x border-t border-b border-line border-b-line-strong bg-white px-1.5 py-3.5 text-[#111] md:w-auto md:px-6 md:py-5"
						>
							<span
								aria-hidden="true"
								className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-violet-500 via-purple-500 to-pink-500"
							/>
							WorkBridge
						</th>
						<th scope="col" className="border-b border-line-strong px-1.5 py-3.5 md:px-6 md:py-5">
							Typical platforms
						</th>
					</tr>
				</thead>
				<tbody>
					{comparisonRows.map((row, index) => {
						const last = index === comparisonRows.length - 1;
						const cell = `px-1.5 py-3.5 text-left align-top leading-[1.35] md:px-6 md:py-5 ${last ? "" : "border-b border-line"}`;

						return (
							<tr key={row.feature}>
								<th scope="row" className={`${cell} font-semibold`}>
									{row.feature}
								</th>
								<td
									className={`${cell} border-x border-line bg-white font-bold text-[#111] ${
										last ? "rounded-b-[14px] border-b" : ""
									}`}
								>
									{row.us}
								</td>
								<td className={`${cell} text-secondary`}>{row.them}</td>
							</tr>
						);
					})}
				</tbody>
			</table>
			<p className="mt-4 text-sm text-secondary">Rates vary by platform and contract.</p>
		</LandingSection>
	);
}

export type Founder = { name: string; photoUrl?: string };

/** Stands in for testimonials at launch. Renders nothing until a real founder is set. */
export function LandingFounderNote({ founder }: { founder: Founder | null }) {
	if (!founder) {
		return null;
	}

	const initials = founder.name
		.split(/\s+/)
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	return (
		<LandingSection labelledBy="founder-heading">
			<div className="grid max-w-245 items-start gap-5 md:grid-cols-[200px_minmax(0,1fr)] md:gap-12">
				{founder.photoUrl ? (
					// eslint-disable-next-line @next/next/no-img-element -- a single small portrait, set by hand
					<img
						src={founder.photoUrl}
						alt={founder.name}
						className="size-28 rounded-2xl object-cover md:h-60 md:w-50"
					/>
				) : (
					<span
						aria-hidden="true"
						className="grid size-28 place-items-center rounded-2xl bg-linear-135 from-violet-100 to-pink-100 text-3xl font-bold text-violet-900 md:h-60 md:w-50 md:text-5xl"
					>
						{initials}
					</span>
				)}
				<div>
					<h2 id="founder-heading" className="mb-3.5 text-[13px] font-bold text-secondary">
						A note from the founder
					</h2>
					<p className="text-[21px] leading-[1.35] font-medium tracking-[-0.012em] md:text-[28px]">
						We&apos;re just getting started, so you won&apos;t find big numbers or long lists of reviews here
						yet. What you will find is a simple idea: clients should be able to find good people, and
						freelancers should keep what they earn. If something could be better, I&apos;d love to hear
						from you.
					</p>
					<p className="mt-6 flex flex-col gap-0.5">
						<span className="text-base font-bold">{founder.name}</span>
						<span className="text-sm text-secondary">Founder, WorkBridge</span>
					</p>
				</div>
			</div>
		</LandingSection>
	);
}

const faqs = [
	{
		question: "Is WorkBridge really free?",
		answer: "Yes. At launch, joining is free for both clients and freelancers, and WorkBridge takes 0% commission.",
	},
	{
		question: "How do payments work?",
		answer: "You agree on a price and pay each other directly. WorkBridge doesn't take a cut or hold funds.",
	},
	{
		question: "Who can join as a freelancer?",
		answer: "Freelancers of every kind, in IT and outside it: designers, developers, marketers, writers, translators, photographers, videographers and more.",
	},
	{
		question: "How do I choose the right freelancer?",
		answer: "Look through profiles and services, chat before you hire and read reviews from earlier clients.",
	},
	{
		question: "What happens after I hire someone?",
		answer: "You both work in a shared workroom with messages. The freelancer marks the work complete, and the client leaves a review.",
	},
	{
		question: "Is my data safe?",
		answer: "Your email and phone number are never shown to other users. You talk through WorkBridge messages and decide yourself what to share. Every account is verified by email.",
	},
];

export function LandingFaq() {
	return (
		<section aria-labelledby="faq-heading" className="border-y border-line bg-white py-14 md:py-22">
			<LandingWrap className="grid items-start gap-5 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:gap-12">
				<SectionHeading id="faq-heading">Questions, answered</SectionHeading>
				<div>
					{faqs.map((faq, index) => (
						<details
							key={faq.question}
							open={index === 0}
							className="group border-b border-line-strong first:border-t"
						>
							<summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-md py-3.5 text-[17px] leading-[1.3] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 md:text-[19px] [&::-webkit-details-marker]:hidden">
								{faq.question}
								<Plus
									aria-hidden="true"
									className="size-5 shrink-0 transition-transform group-open:rotate-45 group-open:text-violet-700 motion-reduce:transition-none"
								/>
							</summary>
							<p className="max-w-170 pb-5.5 text-base text-secondary md:pr-10 md:text-[17px]">{faq.answer}</p>
						</details>
					))}
				</div>
			</LandingWrap>
		</section>
	);
}
