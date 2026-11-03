import { Chip, LandingSection, MockAvatar, MockButton, SectionHeading, cardClass } from "./ui";

const messages = [
	{ from: "Bakery Example", text: "Concept two feels right. Could the wordmark be a little warmer?" },
	{ from: "Ana Example", text: "Yes. I softened the letters. Have a look at the new version.", mine: true },
	{ from: "Bakery Example", text: "That's the one. Thank you!" },
];

const callouts = [
	{ title: "Messages stay with the job", body: "No digging through email to find what you agreed." },
	{ title: "One clear finish", body: "The freelancer marks the work complete." },
	{ title: "A review to close it out", body: "The client leaves a review when the work is done." },
];

export function LandingWorkroomShowcase() {
	return (
		<LandingSection labelledBy="showcase-heading" tone="white">
			<div className="mb-7 md:mb-11">
				<SectionHeading id="showcase-heading">One workroom for the whole job</SectionHeading>
			</div>
			<div className="grid items-center gap-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
				<div
					role="img"
					aria-label="Example of a workroom with a message thread between a sample client and a sample freelancer, and a Mark complete button"
					className={`${cardClass} overflow-hidden shadow-[0_20px_48px_rgba(17,17,17,0.1)]`}
				>
					<div className="grid md:grid-cols-[280px_minmax(0,1fr)]">
						<div className="flex flex-col gap-4 border-b border-line bg-panel-soft p-4 md:border-r md:border-b-0 md:p-6">
							<span className="text-[13px] font-bold text-secondary">Workroom</span>
							<p className="text-xl leading-tight font-bold tracking-[-0.01em]">New logo for a neighborhood bakery</p>
							<Person initials="AE" name="Ana Example" role="Freelancer" />
							<Person initials="BE" name="Bakery Example" role="Client" />
							<div>
								<Chip>In progress</Chip>
							</div>
						</div>
						<div className="flex min-w-0 flex-col gap-4 p-4 md:p-6">
							{messages.map((message, index) => (
								<div
									key={index}
									className={`max-w-[80%] rounded-[14px] px-3.5 py-3 text-[15px] leading-[1.45] ${
										message.mine ? "self-end bg-violet-100" : "bg-background"
									}`}
								>
									<p className="mb-0.5 text-xs font-bold text-secondary">{message.from}</p>
									{message.text}
								</div>
							))}
							<div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
								<span className="text-sm text-secondary">Ready to wrap up?</span>
								<MockButton ink>Mark complete</MockButton>
							</div>
						</div>
					</div>
				</div>
				<ol className="flex flex-col gap-6">
					{callouts.map((callout) => (
						<li key={callout.title} className="flex flex-col gap-1">
							<h3 className="text-xl leading-tight font-bold tracking-[-0.01em]">{callout.title}</h3>
							<p className="text-[17px] text-secondary">{callout.body}</p>
						</li>
					))}
				</ol>
			</div>
		</LandingSection>
	);
}

function Person({ initials, name, role }: { initials: string; name: string; role: string }) {
	return (
		<div className="flex items-center gap-2.5">
			<MockAvatar initials={initials} />
			<div>
				<p className="text-[15px] font-bold">{name}</p>
				<p className="text-sm text-secondary">{role}</p>
			</div>
		</div>
	);
}
