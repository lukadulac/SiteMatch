import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
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
				<LoginForm />
			</section>
		</section>
	);
}
