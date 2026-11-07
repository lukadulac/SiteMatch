import Image from "next/image";
import Link from "next/link";
import { LandingSection, LandingWrap, PrimaryLink, cardClass } from "./ui";

const doors = [
	{
		heading: "Need something done?",
		body: "Post a brief or book a ready-made service.",
		cta: { href: "/register?role=client", label: "Post a project" },
	},
	{
		heading: "Looking for clients?",
		body: "Publish your services and keep what you earn.",
		cta: { href: "/register?role=provider", label: "Start getting clients" },
	},
];

/** Signed-in visitors already chose a side, so the hero's dashboard link covers them. */
export function LandingFinalCta() {
	return (
		<LandingSection label="Get started">
			<div className="grid gap-4 md:grid-cols-2">
				{doors.map((door) => (
					<div
						key={door.heading}
						className={`${cardClass} brand-border flex flex-col items-start gap-3.5 border-[1.5px] p-6 md:p-11`}
					>
						<h2 className="text-[28px] leading-[1.08] font-bold tracking-[-0.025em] md:text-[40px]">
							{door.heading}
						</h2>
						<p className="text-[17px] text-secondary">{door.body}</p>
						<PrimaryLink href={door.cta.href} size="lg" className="mt-3.5 max-md:w-full">
							{door.cta.label}
						</PrimaryLink>
					</div>
				))}
			</div>
		</LandingSection>
	);
}

const browseLinks = [
	{ href: "/find-talent", label: "Find talent" },
	{ href: "/jobs", label: "Find work" },
	{ href: "/#how-it-works", label: "How it works" },
];

const accountLinks = [
	{ href: "/login", label: "Log in" },
	{ href: "/register", label: "Join free" },
];

export function LandingFooter({ dashboardHref }: { dashboardHref: string | null }) {
	const footerLinks = [
		...browseLinks,
		...(dashboardHref ? [{ href: dashboardHref, label: "Dashboard" }] : accountLinks),
		{ href: "/privacy", label: "Privacy" },
		{ href: "/terms", label: "Terms" },
	];

	return (
		<footer>
			<span aria-hidden="true" className="block h-0.5 bg-linear-to-r from-violet-500 via-purple-500 to-pink-500" />
			<LandingWrap className="pt-9 pb-6 md:pt-12 md:pb-8">
				<div className="flex flex-wrap justify-between gap-8">
					<div className="flex max-w-85 flex-col gap-2.5">
						<Link
							href="/"
							className="w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
						>
							<Image
								src="/images/workbridge-logo-tight.png"
								alt="WorkBridge home"
								width={1370}
								height={250}
								className="h-7 w-auto mix-blend-multiply"
							/>
						</Link>
						<p className="text-sm text-secondary">The freelance marketplace with 0% commission.</p>
					</div>
					<nav aria-label="Footer">
						<ul className="flex max-w-140 flex-wrap gap-x-6 text-[15px]">
							{footerLinks.map((link) => (
								<li key={link.href}>
									<Link
										href={link.href}
										className="inline-flex min-h-11 items-center rounded-md text-[#111] hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
									>
										{link.label}
									</Link>
								</li>
							))}
						</ul>
					</nav>
				</div>
				<p className="mt-7 text-sm text-secondary">© {new Date().getFullYear()} WorkBridge</p>
			</LandingWrap>
		</footer>
	);
}
