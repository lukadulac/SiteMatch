import type { Metadata, Viewport } from "next";
import { IdleSessionTimeout } from "@/components/auth/idle-session-timeout";
import Header from "@/components/header/Header";
import { PageFrame } from "@/components/layout/page-frame";
import { getCurrentHeaderState } from "@/lib/navigation/current-header-state";
import "./globals.css";

export const metadata: Metadata = {
	title: "WorkBridge",
	// Set here rather than per page so every route gets the favicon. icon-192.png and
	// icon.png (512) are the install icons, listed in app/manifest.ts.
	icons: {
		icon: [
			{ url: "/icons/favicon.ico", sizes: "16x16 32x32" },
			{ url: "/icons/icon.svg", type: "image/svg+xml" },
		],
		shortcut: "/icons/favicon.ico",
		apple: [{ url: "/icons/apple-icon.png", sizes: "180x180", type: "image/png" }],
	},
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
	const { user } = await getCurrentHeaderState();

	return (
		<html lang="en" className="h-full antialiased" data-scroll-behavior="smooth">
			<body className="min-h-full flex flex-col bg-background text-foreground">
				<IdleSessionTimeout />
				<Header user={user} />
				<main className="flex-1 w-full">
					<PageFrame>{children}</PageFrame>
				</main>
			</body>
		</html>
	);
}
