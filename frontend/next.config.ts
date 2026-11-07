import path from "node:path";
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
		value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
	},
	// Another site that opens WorkBridge in a window cannot reach back into it.
	{
		key: "Cross-Origin-Opener-Policy",
		value: "same-origin",
	},
	{
		key: "X-DNS-Prefetch-Control",
		value: "off",
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

// frontend/ is its own npm project; the repository root's lockfile only holds the Supabase CLI.
const projectRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
	turbopack: {
		root: projectRoot,
	},
	outputFileTracingRoot: projectRoot,
	experimental: {
		serverActions: {
			allowedOrigins: developmentServerActionOrigins,
			bodySizeLimit: "64kb",
		},
	},
	productionBrowserSourceMaps: false,
	// Do not advertise the framework in every response.
	poweredByHeader: false,
	// The browser only sees this origin. fallback runs after every Next.js route, so a route
	// moves to the Express backend (spec/express-backend.md) when its Next.js handler is deleted.
	async rewrites() {
		const backend = process.env.BACKEND_URL;
		if (!backend) throw new Error("Set BACKEND_URL.");
		return {
			beforeFiles: [],
			afterFiles: [],
			fallback: [
				{ source: "/api/:path*", destination: `${backend}/api/:path*` },
				{ source: "/auth/:path*", destination: `${backend}/auth/:path*` },
			],
		};
	},
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
			{
				source: "/forgot-password",
				headers: [
					{
						key: "Cache-Control",
						value: "no-store, max-age=0",
					},
				],
			},
			{
				source: "/reset-password",
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
