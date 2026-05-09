import type { Metadata } from "next";
import Header from "@/components/header/Header";
import SiteContainer from "@/components/layout/SiteContainer";
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
				<Header />
				<main className="flex-1 w-full">
					<SiteContainer>{children}</SiteContainer>
				</main>
			</body>
		</html>
	);
}
