import Link from "next/link";
import type { ReactNode } from "react";

/** Matches the header's width and gutters so the page lines up under the logo. */
export function LandingWrap({ className = "", children }: { className?: string; children: ReactNode }) {
	return <div className={`mx-auto w-full max-w-300 px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

type LandingSectionProps = {
	id?: string;
	labelledBy?: string;
	label?: string;
	/** White bands alternate with the page background to pace the scroll. */
	tone?: "page" | "white";
	className?: string;
	children: ReactNode;
};

export function LandingSection({
	id,
	labelledBy,
	label,
	tone = "page",
	className = "",
	children,
}: LandingSectionProps) {
	return (
		<section
			id={id}
			aria-labelledby={labelledBy}
			aria-label={label}
			className={`scroll-mt-20 py-14 md:py-22 ${
				tone === "white" ? "border-y border-line bg-white" : ""
			} ${className}`}
		>
			<LandingWrap>{children}</LandingWrap>
		</section>
	);
}

export function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
	return (
		<h2 id={id} className="text-3xl leading-[1.08] font-bold tracking-tight text-[#111] md:text-5xl">
			{children}
		</h2>
	);
}

const focusRing =
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2";

export function PrimaryLink({
	href,
	size = "md",
	className = "",
	children,
}: {
	href: string;
	size?: "md" | "lg";
	className?: string;
	children: ReactNode;
}) {
	const sizeClass =
		size === "lg" ? "min-h-14 rounded-xl px-6.5 text-[17px]" : "min-h-11 rounded-[10px] px-4.5 text-base";

	return (
		<Link
			href={href}
			className={`inline-flex items-center justify-center bg-[#111] text-center font-semibold text-white transition hover:bg-zinc-800 hover:shadow-[0_6px_20px_rgba(168,85,247,0.35)] ${sizeClass} ${focusRing} ${className}`}
		>
			{children}
		</Link>
	);
}

export function TextLink({ href, className = "", children }: { href: string; className?: string; children: ReactNode }) {
	return (
		<Link
			href={href}
			className={`inline-flex min-h-11 items-center rounded-md text-base font-semibold text-[#111] underline underline-offset-4 hover:text-violet-700 ${focusRing} ${className}`}
		>
			{children}
		</Link>
	);
}

export function Chip({ children }: { children: ReactNode }) {
	return (
		<span className="rounded-full bg-background px-2.5 py-1.5 text-[13px] leading-none whitespace-nowrap text-secondary">
			{children}
		</span>
	);
}

/** Initials on the brand tint, for the fictional people in the product mocks. */
export function MockAvatar({ initials }: { initials: string }) {
	return (
		<span
			aria-hidden="true"
			className="grid size-9 shrink-0 place-items-center rounded-full bg-linear-135 from-violet-100 to-pink-100 text-[13px] font-bold text-violet-900 md:size-10 md:text-sm"
		>
			{initials}
		</span>
	);
}

/** A button-shaped label inside a static mock; it is a picture, not a control. */
export function MockButton({ ink = false, children }: { ink?: boolean; children: ReactNode }) {
	return (
		<span
			className={`rounded-[9px] border px-4 py-2.5 text-sm font-semibold whitespace-nowrap ${
				ink ? "border-[#111] bg-[#111] text-white" : "border-line-strong text-[#111]"
			}`}
		>
			{children}
		</span>
	);
}

export const cardClass = "rounded-2xl border border-line bg-white";
export const liftClass = "shadow-[0_12px_32px_rgba(17,17,17,0.08)]";
