import Link from "next/link";
import { Avatar } from "@/components/profile/avatar";

type PostedByCardProps = {
	client: {
		id: string;
		full_name: string;
		avatar_url: string | null;
		city: string | null;
		country: string | null;
	};
};

/** Only what get_public_profile() exposes: no email, phone or tax ID. */
export function PostedByCard({ client }: PostedByCardProps) {
	const location = [client.city, client.country].filter(Boolean).join(", ");

	return (
		<section
			aria-labelledby="posted-by-heading"
			className="rounded-3xl border border-line bg-panel px-5 py-5"
		>
			<h2 id="posted-by-heading" className="mb-3.5 text-sm font-semibold text-secondary">
				Posted by
			</h2>
			<div className="flex items-center gap-3.5">
				<Avatar name={client.full_name} avatarPath={client.avatar_url} size="lg" />
				<div className="min-w-0 flex-1">
					<p className="truncate text-base font-semibold text-foreground">{client.full_name}</p>
					{location ? <p className="mt-0.5 truncate text-sm text-secondary">{location}</p> : null}
				</div>
				<Link
					href={`/profiles/${client.id}`}
					className="py-3 text-sm font-semibold text-foreground underline underline-offset-4 hover:text-secondary"
				>
					View profile
				</Link>
			</div>
		</section>
	);
}
