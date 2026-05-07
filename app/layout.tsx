import type { Metadata } from "next";
import { SiteHeader } from "@/components/navigation/site-header";
import "./globals.css";

export const metadata: Metadata = {
	title: "SiteMatch",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="h-full antialiased">
			<body className="min-h-full flex flex-col bg-background text-foreground">
				<SiteHeader />
				<div className="flex-1">{children}</div>
			</body>
		</html>
	);
}
