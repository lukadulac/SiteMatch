import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { legal } from "@/lib/legal";

export const metadata: Metadata = {
	title: "Terms of Service",
	description: "The rules for using WorkBridge as a client or a freelancer.",
};

export default function TermsPage() {
	return (
		<LegalPage
			title="Terms of Service"
			intro={
				<p>
					These terms are an agreement between you and {legal.operatorName} (&ldquo;WorkBridge&rdquo;,
					&ldquo;we&rdquo;) about using the WorkBridge marketplace. By creating an account you accept them. If you
					do not agree, do not use WorkBridge.
				</p>
			}
		>
			<LegalSection title="What WorkBridge is">
				<p>
					WorkBridge is a place where clients and independent freelancers find each other: clients post briefs or
					request published services, freelancers apply or answer requests, and both sides talk through WorkBridge
					messages. We are not a party to the work you agree on, we do not employ freelancers and we do not
					guarantee the quality, safety or legality of any work, brief or service.
				</p>
			</LegalSection>

			<LegalSection title="Payments and fees">
				<p>
					WorkBridge does not process payments or hold money. Clients and freelancers agree on the price and pay
					each other directly, and each side is responsible for its own invoices and taxes. WorkBridge currently
					charges no commission and no fee to join. If we ever introduce fees, we will tell you in advance and they
					will not apply to work agreed before that.
				</p>
			</LegalSection>

			<LegalSection title="Your account">
				<ul>
					<li>You must be at least 18 and able to enter into a contract.</li>
					<li>Give accurate information and keep it up to date. One person, one account per role.</li>
					<li>Keep your password secret. You are responsible for what happens under your account.</li>
					<li>You can delete your account at any time from your profile page.</li>
				</ul>
			</LegalSection>

			<LegalSection title="What you must not do">
				<ul>
					<li>Post anything illegal, misleading, discriminatory, hateful or that infringes someone else&apos;s rights.</li>
					<li>Offer or request work that is illegal, such as fake reviews, academic dishonesty or anything harmful.</li>
					<li>Spam, scam or harass other users, or collect their data for purposes unrelated to a job.</li>
					<li>Try to break, overload or get around the security of WorkBridge, or access accounts that are not yours.</li>
				</ul>
				<p>
					We may hide content, suspend or close accounts that break these terms, and we keep a record of those
					decisions. If you think we got it wrong, write to {legal.contactEmail}.
				</p>
			</LegalSection>

			<LegalSection title="Your content">
				<p>
					You keep the rights to what you post. You allow us to store and show it on WorkBridge so the marketplace
					works, for as long as it is on the site. What you deliver to a client, and who owns it, is between you and
					the client.
				</p>
			</LegalSection>

			<LegalSection title="Disclaimers and liability">
				<p>
					WorkBridge is provided &ldquo;as is&rdquo;. We work to keep it available and secure but cannot promise it
					will always be. To the extent the law allows, we are not liable for disputes between users, for work
					delivered or not delivered, for payments between users, or for indirect losses. Nothing in these terms
					limits liability that cannot be limited by law, or your rights as a consumer.
				</p>
			</LegalSection>

			<LegalSection title="Changes and governing law">
				<p>
					We may update these terms. If a change matters, we will tell signed-in users before it applies, and
					continuing to use WorkBridge means you accept it. These terms are governed by the law of{" "}
					{legal.governingLaw}, without taking away the protection of the law where you live. Questions go to{" "}
					{legal.contactEmail}. How we handle personal data is in our{" "}
					<Link href="/privacy" className="font-semibold text-[#111] underline underline-offset-4">Privacy Policy</Link>.
				</p>
			</LegalSection>
		</LegalPage>
	);
}
