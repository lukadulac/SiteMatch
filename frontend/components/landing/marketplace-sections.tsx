import Link from "next/link";
import { Camera, Code2, Megaphone, PenLine, Plus, Sparkles, type LucideIcon } from "lucide-react";
import { Chip, LandingSection, SectionHeading, cardClass } from "./ui";

const categories: Array<{ label: string; icon: LucideIcon }> = [
	{ label: "Tech & IT", icon: Code2 },
	{ label: "Design & creative", icon: Sparkles },
	{ label: "Marketing & sales", icon: Megaphone },
	{ label: "Writing & translation", icon: PenLine },
	{ label: "Photo & video", icon: Camera },
];

const tileClass =
	"flex min-h-31 flex-col justify-between gap-5 rounded-2xl border p-4 text-base leading-tight font-semibold text-[#111] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 motion-reduce:hover:translate-y-0 md:min-h-44 md:gap-9 md:p-5 md:text-lg";

export function LandingCategories() {
	return (
		<LandingSection labelledBy="categories-heading" className="pt-0! md:pt-0!">
			<div className="mb-7 md:mb-11">
				<SectionHeading id="categories-heading">Work of every kind, in tech and beyond.</SectionHeading>
			</div>
			<ul className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4 xl:grid-cols-6">
				{categories.map(({ label, icon: Icon }) => (
					<li key={label} className="grid">
						<Link href="/find-talent" className={`${tileClass} brand-hover-border border-line bg-white`}>
							<span
								aria-hidden="true"
								className="grid size-11 place-items-center rounded-xl bg-linear-135 from-violet-100 to-pink-100 text-violet-700"
							>
								<Icon className="size-6" strokeWidth={1.6} />
							</span>
							{label}
						</Link>
					</li>
				))}
				<li className="grid">
					<Link href="/find-talent" className={`${tileClass} border-dashed border-line-strong hover:border-violet-400`}>
						<span aria-hidden="true" className="grid size-11 place-items-center rounded-xl text-violet-700">
							<Plus className="size-6" strokeWidth={1.6} />
						</span>
						+10 more categories
					</Link>
				</li>
			</ul>
		</LandingSection>
	);
}

export function LandingWhy() {
	return (
		<LandingSection labelledBy="why-heading" tone="white">
			<div className="mb-7 md:mb-11">
				<SectionHeading id="why-heading">Why WorkBridge</SectionHeading>
			</div>
			<div className="grid gap-4 md:grid-cols-2 md:grid-rows-2">
				<div className="flex flex-col justify-between gap-7 rounded-2xl bg-[#111] p-6 text-white md:row-span-2 md:gap-12 md:p-9">
					<p
						aria-hidden="true"
						className="w-fit bg-linear-to-r from-violet-500 via-purple-500 to-pink-500 bg-clip-text pr-[0.06em] text-[6.5rem] leading-[0.9] font-bold tracking-[-0.05em] text-transparent md:text-[9.5rem]"
					>
						0%
					</p>
					<div>
						<h3 className="text-[26px] leading-tight font-bold tracking-[-0.01em] md:text-3xl">0% commission</h3>
						<p className="mt-2.5 max-w-110 text-lg text-zinc-300">
							You agree on a price and pay each other directly, so all of it goes to the freelancer.
						</p>
					</div>
				</div>
				<WhyCard
					title="Two ways to hire"
					body="Post a brief and let freelancers apply, or book a ready-made service with a set price."
					chips={["Post a brief", "Book a service"]}
				/>
				<WhyCard
					title="Everything in one place"
					body="From the first message to the finished job, the whole conversation stays together."
					chips={["Messages", "Requests", "Workroom"]}
				/>
			</div>
		</LandingSection>
	);
}

function WhyCard({ title, body, chips }: { title: string; body: string; chips: string[] }) {
	return (
		<div className={`${cardClass} flex flex-col gap-3.5 p-6 md:p-7`}>
			<h3 className="text-2xl leading-tight font-bold tracking-[-0.01em]">{title}</h3>
			<p className="text-[17px] text-secondary">{body}</p>
			<div className="flex flex-wrap gap-2">
				{chips.map((chip) => (
					<Chip key={chip}>{chip}</Chip>
				))}
			</div>
		</div>
	);
}
