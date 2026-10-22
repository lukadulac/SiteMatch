import Image from "next/image";
import type { RegisterRole } from "@/components/auth/register/RegisterForm";

type RoleSelectorProps = {
	selectedRole: RegisterRole | null;
	onRoleChange: (role: RegisterRole) => void;
	error?: string;
};

export default function RoleSelector({
	selectedRole,
	onRoleChange,
	error,
}: RoleSelectorProps) {
	const isClientSelected = selectedRole === "client";
	const isProviderSelected = selectedRole === "provider";

	return (
		<fieldset aria-invalid={Boolean(error)} aria-describedby={error ? "role-error" : undefined}>
			<legend className="mb-4 block text-sm font-medium">I want to: <span className="text-xs font-semibold text-red-700">Required</span></legend>

			<div className="grid gap-4 md:grid-cols-2">
				<label
					className={`relative rounded-xl border-2 p-6 text-left transition-all md:mb-4 ${
						isClientSelected
							? "border-pink-500 bg-foreground/5"
							: "border-gray-400 hover:border-muted-foreground/50"
					}`}
				>
					<input type="radio" name="role" value="client" checked={isClientSelected} onChange={() => onRoleChange("client")} className="sr-only peer" />
					<div className="mb-3 flex items-start justify-between">
						<div
							className={`rounded-lg p-3 ${
								isClientSelected
									? "bg-foreground text-background"
									: "bg-muted text-muted-foreground"
							}`}
						>
							<Image
								src="/icons/bag-icon.svg"
								alt="Client tab"
								className="whiteIcon h-6 w-6"
								width={24}
								height={24}
							/>
						</div>

						<div
							className={`rounded-full bg-foreground p-1 text-background ${
								isClientSelected ? "visible" : "invisible"
							}`}
						>
							<Image
								src="/icons/check-icon.svg"
								alt="Checked field"
								aria-hidden="true"
								className="h-5 w-5 whiteIcon"
								width={20}
								height={20}
							/>
						</div>
					</div>

					<h3 className="mb-1 text-lg font-semibold">Hire Talent</h3>
					<p className="text-sm text-muted-foreground">
						Find and hire skilled professionals for your projects
					</p>
					<p className="text-sm text-muted">
						(If you are a client with an idea, select this field)
					</p>
				</label>

				<label
					className={`relative mb-4 rounded-xl border-2 p-6 text-left transition-all ${
						isProviderSelected
							? "border-pink-500 bg-foreground/5"
							: "border-gray-400 hover:border-muted-foreground/50"
					}`}
				>
					<input type="radio" name="role" value="provider" checked={isProviderSelected} onChange={() => onRoleChange("provider")} className="sr-only peer" />
					<div className="mb-3 flex items-start justify-between">
						<div
							className={`rounded-lg p-3 ${
								isProviderSelected
									? "bg-foreground text-background"
									: "bg-muted text-muted-foreground"
							}`}
						>
							<Image
								src="/icons/user-icon.svg"
								alt="Provider tab"
								className="h-6 w-6 whiteIcon"
								width={24}
								height={24}
							/>
						</div>

						<div
							className={`rounded-full bg-foreground p-1 text-background ${
								isProviderSelected ? "visible" : "invisible"
							}`}
						>
							<Image
								src="/icons/check-icon.svg"
								alt=""
								aria-hidden="true"
								className="h-4 w-4 whiteIcon"
								width={16}
								height={16}
							/>
						</div>
					</div>

					<h3 className="mb-1 text-lg font-semibold">Find Work</h3>
					<p className="text-sm text-muted-foreground">
						Showcase your skills and connect with clients
					</p>
					<p className="text-sm text-muted">
						(If you&apos;re a provider, select this field)
					</p>
				</label>
			</div>
			{error ? <p id="role-error" className="text-sm font-medium text-red-700">{error}</p> : null}
		</fieldset>
	);
}
