"use client";

import { useId, useState } from "react";

/** Briefs shorter than this already fit in the collapsed height. */
const COLLAPSE_AFTER_CHARS = 480;

export function ExpandableText({ text }: { text: string }) {
	const [expanded, setExpanded] = useState(false);
	const id = useId();
	const collapsible = text.length > COLLAPSE_AFTER_CHARS;

	return (
		<div>
			<p
				id={id}
				className={`whitespace-pre-line wrap-break-word text-base leading-relaxed text-foreground ${
					collapsible && !expanded ? "line-clamp-6" : ""
				}`}
			>
				{text}
			</p>
			{collapsible ? (
				<button
					type="button"
					aria-expanded={expanded}
					aria-controls={id}
					onClick={() => setExpanded((value) => !value)}
					className="mt-2 min-h-11 text-[0.9375rem] font-semibold text-foreground underline underline-offset-4 hover:text-secondary"
				>
					{expanded ? "Show less" : "Show more"}
				</button>
			) : null}
		</div>
	);
}
