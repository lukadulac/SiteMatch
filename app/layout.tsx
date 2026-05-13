import type { Metadata } from "next";
import Header from "@/components/header/Header";
import SiteContainer from "@/components/layout/SiteContainer";
import { getDashboardPath } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
	title: "SiteMatch",
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const headerAuthState = await getHeaderAuthState();

	return (
		<html lang="en" className="h-full antialiased">
			<body className="min-h-full flex flex-col bg-background text-foreground">
				<Header {...headerAuthState} />
				<main className="flex-1 w-full">
					<SiteContainer>{children}</SiteContainer>
				</main>
			</body>
		</html>
	);
}

async function getHeaderAuthState() {
	const supabase = await createSupabaseServerClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return {
			isAuthenticated: false,
			profileHref: "/dashboard",
		};
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("role")
		.eq("id", user.id)
		.maybeSingle();

	const metadataRole =
		user.user_metadata &&
		typeof user.user_metadata === "object" &&
		typeof user.user_metadata.role === "string"
			? user.user_metadata.role
			: null;

	const role = profile?.role ?? metadataRole;

	return {
		isAuthenticated: true,
		profileHref:
			role === "client" || role === "provider" || role === "admin"
				? getDashboardPath(role)
				: "/dashboard",
	};
}
