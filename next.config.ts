import type { NextConfig } from "next";

const securityHeaders = [
	{
		key: "Referrer-Policy",
		value: "strict-origin-when-cross-origin",
	},
	{
		key: "X-Content-Type-Options",
		value: "nosniff",
	},
	{
		key: "X-Frame-Options",
		value: "DENY",
	},
	{
		key: "Permissions-Policy",
		value: "camera=(), microphone=(), geolocation=()",
	},
];

const productionSecurityHeaders =
	process.env.NODE_ENV === "production"
		? [
				...securityHeaders,
				{
					key: "Strict-Transport-Security",
					value: "max-age=31536000; includeSubDomains",
				},
			]
		: securityHeaders;

const developmentServerActionOrigins =
	process.env.NODE_ENV === "development"
		? ["localhost:3000", "127.0.0.1:3000", "0.0.0.0:3000", "192.168.1.5:3000"]
		: [];

const nextConfig: NextConfig = {
	experimental: {
		serverActions: {
			allowedOrigins: developmentServerActionOrigins,
			bodySizeLimit: "64kb",
		},
	},
	productionBrowserSourceMaps: false,
	async headers() {
		return [
			{
				source: "/:path*",
				headers: productionSecurityHeaders,
			},
			{
				source: "/login",
				headers: [
					{
						key: "Cache-Control",
						value: "no-store, max-age=0",
					},
				],
			},
			{
				source: "/register",
				headers: [
					{
						key: "Cache-Control",
						value: "no-store, max-age=0",
					},
				],
			},
		];
	},
};

export default nextConfig;
