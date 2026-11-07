import type { ReactNode } from "react";
import { legal } from "@/lib/legal";

/** Shared layout for the Privacy Policy and Terms: one readable column of headed sections. */
export function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
	return (
		<article className="mx-auto max-w-3xl py-6 text-[#111] sm:py-10">
			<h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
			<p className="mt-2 text-sm text-secondary">Last updated: {legal.lastUpdated}</p>
			<div className="mt-6 text-base leading-7 text-secondary">{intro}</div>
			<div className="mt-8 space-y-8">{children}</div>
		</article>
	);
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section>
			<h2 className="text-xl font-semibold text-[#111]">{title}</h2>
			<div className="mt-3 space-y-3 text-base leading-7 text-secondary [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
				{children}
			</div>
		</section>
	);
}
