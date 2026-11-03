import { PenTool } from "lucide-react";
import { Chip, MockAvatar, MockButton, cardClass, liftClass } from "./ui";

const applications = [
	{ initials: "AE", name: "Ana Example", note: "Brand designer. Sketches first, three concepts.", price: "$280" },
	{ initials: "TS", name: "Theo Sample", note: "Logo and packaging for small food brands.", price: "$340" },
	{ initials: "PD", name: "Priya Demo", note: "Can start this week. Files for print and web.", price: "$220", optional: true },
];

// The mocks stack on phones and fan out as overlapping cards from md up.
const backCardClass = `${cardClass} ${liftClass} brand-border relative flex flex-col gap-2 border-[1.5px] p-4 pb-9 md:absolute md:top-0 md:left-0 md:gap-3`;
const frontStackClass =
	"relative -mt-5 ml-4 flex flex-col gap-2 md:absolute md:right-0 md:m-0 md:gap-3";
const mockTitleClass = "text-[19px] leading-tight font-bold tracking-[-0.01em] md:text-2xl";
const labelClass = "text-[13px] font-bold text-secondary";

/** Hiring side: a client's brief with applications coming in. */
export function BriefMock() {
	return (
		<div
			role="img"
			aria-label="Example of a posted brief with three applications from sample freelancers"
			className="relative md:h-152"
		>
			<div className={`${backCardClass} md:w-[76%] md:p-6 md:pb-12`}>
				<div className="flex items-center justify-between gap-3">
					<span className={labelClass}>Your brief</span>
					<Chip>3 applications</Chip>
				</div>
				<p className={mockTitleClass}>New logo for a neighborhood bakery</p>
				<p className="text-[15px] leading-normal text-secondary max-md:hidden">
					A warm, simple mark for our shop sign, packaging and social media.
				</p>
				<div className="flex flex-wrap gap-2">
					<Chip>Design &amp; creative</Chip>
					<Chip>Budget $200–$400</Chip>
				</div>
			</div>

			<div className={`${frontStackClass} md:top-59 md:left-[14%]`}>
				{applications.map((application) => (
					<div
						key={application.name}
						className={`${cardClass} ${liftClass} flex items-center gap-3.5 px-3.5 py-3 md:px-4.5 md:py-4 ${
							application.optional ? "max-md:hidden" : ""
						}`}
					>
						<MockAvatar initials={application.initials} />
						<div className="min-w-0 flex-1">
							<p className="text-base font-bold">{application.name}</p>
							<p className="text-sm leading-snug text-secondary">{application.note}</p>
						</div>
						<p className="text-base font-bold">{application.price}</p>
					</div>
				))}
			</div>
		</div>
	);
}

/** Freelancer side: a published service and a request from a client. */
export function ServiceMock() {
	return (
		<div
			role="img"
			aria-label="Example of a published service with an incoming request from a sample client"
			className="relative md:h-152"
		>
			<div className={`${backCardClass} md:w-[72%] md:gap-3.5 md:px-6 md:pt-4 md:pb-18`}>
				<div
					aria-hidden="true"
					className="-mx-2 grid h-37.5 place-items-center rounded-[10px] bg-linear-135 from-violet-200 to-pink-200 text-violet-700 max-md:hidden"
				>
					<PenTool className="size-11" strokeWidth={1.5} />
				</div>
				<div className="flex items-center justify-between gap-3">
					<span className={labelClass}>Your service</span>
					<Chip>Published</Chip>
				</div>
				<p className={mockTitleClass}>Logo design with three concepts</p>
				<p className="text-base text-secondary">
					Starting at <strong className="text-[#111]">$180</strong>
				</p>
			</div>

			<div className={`${frontStackClass} md:top-82.5 md:left-[16%]`}>
				<div className={`${cardClass} ${liftClass} flex flex-col gap-3 p-4.5 md:p-5`}>
					<div className="flex items-center gap-3.5">
						<MockAvatar initials="BE" />
						<div className="min-w-0 flex-1">
							<p className={labelClass}>New request</p>
							<p className="text-base font-bold">Bakery Example</p>
						</div>
						<Chip>Commission 0%</Chip>
					</div>
					<p className="text-[15px] leading-normal text-secondary">
						Hi! We love your work. Could you start on our logo next week?
					</p>
					<div className="flex gap-2 max-md:hidden">
						<MockButton ink>Accept</MockButton>
						<MockButton>Message</MockButton>
					</div>
				</div>
			</div>
		</div>
	);
}
