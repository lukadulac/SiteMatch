"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import SiteContainer from "@/components/layout/SiteContainer";

/** The homepage runs full width bands of its own; every other page sits in the container. */
export function PageFrame({ children }: { children: ReactNode }) {
	const pathname = usePathname();

	if (pathname === "/") {
		return children;
	}

	return <SiteContainer>{children}</SiteContainer>;
}
