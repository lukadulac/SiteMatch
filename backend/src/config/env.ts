import { z } from "zod";

// The only module that reads process.env. Everything else imports `env`.

const emptyAsMissing = (value: unknown) => (value === "" ? undefined : value);

const optionalSecret = z.preprocess(emptyAsMissing, z.string().min(1).optional());

const commaList = z
	.string()
	.transform((value) => value.split(",").map((item) => item.trim()).filter(Boolean));

const envSchema = z.object({
	SUPABASE_URL: z.url(),
	SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
	// Lazy: only the features that need the service role fail without it.
	SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
	AUTH_RATE_LIMIT_SECRET: optionalSecret,
	// A comma-separated list, so a secret can be rotated without downtime.
	INTERNAL_API_SECRET: commaList.pipe(z.array(z.string().min(32)).min(1)),
	SITE_URL: z.url(),
	FRONTEND_ORIGINS: commaList.pipe(
		z.array(z.url().transform((value) => new URL(value).origin)).min(1),
	),
	TRUST_PROXY_HOPS: z.preprocess(emptyAsMissing, z.coerce.number().int().min(0).default(1)),
	PORT: z.preprocess(emptyAsMissing, z.coerce.number().int().positive().default(4000)),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
	const parsed = envSchema.safeParse(source);

	if (!parsed.success) {
		// Names only: a value may be a secret.
		const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))];
		throw new Error(`Invalid backend environment: ${names.join(", ")}. See backend/.env.example.`);
	}

	return parsed.data;
}

export const env = parseEnv(process.env);
