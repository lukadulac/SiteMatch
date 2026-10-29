import Image from "next/image";
import Link from "next/link";

/** Uses a tightly cropped copy of the logo so it can sit 28px tall in the 56px bar. */
export function Logo({ onNavigate }: { onNavigate?: () => void }) {
	return (
		<Link
			href="/"
			onClick={onNavigate}
			className="-m-1 shrink-0 rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
		>
			<Image
				src="/images/workbridge-logo-tight.png"
				alt="WorkBridge"
				width={1370}
				height={250}
				priority
				className="h-7 w-auto mix-blend-multiply lg:h-8"
			/>
		</Link>
	);
}
