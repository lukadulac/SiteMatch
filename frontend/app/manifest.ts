import type { MetadataRoute } from "next";

/** Lets phones add WorkBridge to the home screen with the brand icon. */
export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "WorkBridge",
		short_name: "WorkBridge",
		description: "The freelance marketplace with 0% commission.",
		start_url: "/",
		display: "standalone",
		background_color: "#f5f5f4",
		theme_color: "#f5f5f4",
		icons: [
			{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
			{ src: "/icons/icon.png", sizes: "512x512", type: "image/png" },
		],
	};
}
