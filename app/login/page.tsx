import { LoginForm } from "@/components/auth/login-form";
import { getSafeReturnPath } from "@/lib/auth/return-url";

type LoginPageProps = {
	searchParams: Promise<{
		next?: string | string[];
		confirmed?: string | string[];
		reset?: string | string[];
		deleted?: string | string[];
	}>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
	const { next, confirmed, reset, deleted } = await searchParams;
	const safeNext = getSafeReturnPath(next);

	return (
		<section>
			<h1 className="text-center text-4xl font-semibold">
				Welcome Back to Work
				<span className="bg-linear-to-r from-violet-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
					Bridge
				</span>
			</h1>
			<p className="mt-2 mb-4 text-center">
				Sign in to your WorkBridge account
			</p>

			<section>
				{confirmed === "1" ? <p role="status" className="mx-auto my-4 max-w-112.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">Your email is confirmed. Sign in to continue.</p> : null}
				{reset === "1" ? <p role="status" className="mx-auto my-4 max-w-112.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">Your password is changed. Sign in with the new password.</p> : null}
				{deleted === "1" ? <p role="status" className="mx-auto my-4 max-w-112.5 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-black">Your account is deleted. Thank you for trying WorkBridge.</p> : null}
				<LoginForm next={safeNext} />
			</section>
		</section>
	);
}
