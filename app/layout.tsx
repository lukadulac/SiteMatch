import type { Metadata, Viewport } from "next";
import { IdleSessionTimeout } from "@/components/auth/idle-session-timeout";
import Header from "@/components/header/Header";
import SiteContainer from "@/components/layout/SiteContainer";
import { getHeaderState } from "@/lib/navigation/header-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
	title: "Finder",
};

// Lets the header and menu pad themselves with env(safe-area-inset-*) on notched phones.
export const viewport: Viewport = {
	viewportFit: "cover",
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const { user } = await getHeaderState(await createSupabaseServerClient());

	return (
		<html lang="en" className="h-full antialiased" data-scroll-behavior="smooth">
			<body className="min-h-full flex flex-col bg-background text-foreground">
				<IdleSessionTimeout />
				<Header user={user} />
				<main className="flex-1 w-full">
					<SiteContainer>{children}</SiteContainer>
				</main>
			</body>
		</html>
	);
}
