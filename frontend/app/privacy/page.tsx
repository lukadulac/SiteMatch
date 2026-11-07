import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { legal } from "@/lib/legal";

export const metadata: Metadata = {
	title: "Privacy Policy",
	description: "What personal data WorkBridge collects, why, who sees it and how to delete it.",
};

export default function PrivacyPage() {
	return (
		<LegalPage
			title="Privacy Policy"
			intro={
				<p>
					This policy explains what personal data WorkBridge collects when you use the marketplace, why we use it,
					who can see it and the choices you have. WorkBridge is run by {legal.operatorName}, {legal.operatorAddress}{" "}
					(&ldquo;we&rdquo;), the controller of your data. Questions go to {legal.contactEmail}.
				</p>
			}
		>
			<LegalSection title="What we collect">
				<ul>
					<li>
						<strong className="text-[#111]">Account details:</strong> your name, email address, password (stored
						only as a secure hash by our authentication provider), role (client or freelancer), and optionally your
						phone number, country, city and profile photo.
					</li>
					<li>
						<strong className="text-[#111]">Profile details:</strong> for clients, business information such as the
						business name, type and website; for freelancers, details such as your headline, about text, service
						categories, portfolio and social links, rates and business registration number.
					</li>
					<li>
						<strong className="text-[#111]">What you post and send:</strong> project briefs, published services,
						applications, service requests and the messages you exchange with other users.
					</li>
					<li>
						<strong className="text-[#111]">Technical data:</strong> the cookies that keep you signed in, and your IP
						address, which we use only in a one-way hashed form to limit repeated sign-in and sign-up attempts. Our
						hosting provider keeps standard server logs.
					</li>
				</ul>
				<p>We do not process payments, so we never collect card or bank details.</p>
			</LegalSection>

			<LegalSection title="Why we use it">
				<ul>
					<li>To run the marketplace: create your account, show your profile and listings, and deliver your messages (performance of our contract with you).</li>
					<li>To keep WorkBridge safe: prevent abuse and fraud, rate-limit sign-in attempts and moderate content that breaks our Terms (our legitimate interest).</li>
					<li>To send account emails, such as email confirmation and password reset links (performance of our contract with you).</li>
				</ul>
				<p>We do not sell your data, show ads or use advertising or analytics cookies.</p>
			</LegalSection>

			<LegalSection title="Who can see your data">
				<ul>
					<li>
						<strong className="text-[#111]">Everyone, including visitors who are not signed in:</strong> your public
						profile (name, photo, country, city and the profile details you add), your published services and open
						project briefs.
					</li>
					<li>
						<strong className="text-[#111]">Only the people you talk to:</strong> your messages, applications and
						service requests.
					</li>
					<li>
						<strong className="text-[#111]">Never shown to other users:</strong> your email address and phone
						number. You decide what to share in your messages.
					</li>
					<li>
						<strong className="text-[#111]">Our service providers,</strong> who process data on our behalf: Supabase
						(database, authentication and file storage), Vercel (website hosting) and our email delivery provider.
						They may process data outside your country under appropriate safeguards, such as standard contractual
						clauses.
					</li>
				</ul>
			</LegalSection>

			<LegalSection title="Cookies and local storage">
				<p>
					We use only cookies that are necessary for the site to work: they keep you signed in and secure the
					password reset flow. Your browser&apos;s local storage remembers when you were last active, so we can sign
					you out after an hour of inactivity. Because we use no optional cookies, there is nothing to opt into.
				</p>
			</LegalSection>

			<LegalSection title="How long we keep it">
				<p>
					We keep your data while your account exists. When you delete your account, we remove your profile details,
					published services and open briefs, and close your login. Messages and completed or ongoing work stay
					visible to the other person, shown as &ldquo;Deleted user&rdquo;, because they are part of that
					person&apos;s records too.
				</p>
			</LegalSection>

			<LegalSection title="Your rights">
				<p>Depending on where you live (for example under the GDPR in the EU and UK), you can:</p>
				<ul>
					<li>see and correct your data, which you can do yourself on your profile page;</li>
					<li>
						delete your account at any time from your profile page (Delete account), or by writing to{" "}
						{legal.contactEmail};
					</li>
					<li>ask for a copy of your data, object to or restrict how we use it, by writing to {legal.contactEmail};</li>
					<li>complain to your data protection authority.</li>
				</ul>
			</LegalSection>

			<LegalSection title="Age">
				<p>WorkBridge is for people aged 18 and over. Do not create an account if you are younger.</p>
			</LegalSection>

			<LegalSection title="Changes">
				<p>
					If we change this policy in a way that matters, we will update the date above and tell signed-in users
					before the change applies. See also our <Link href="/terms" className="font-semibold text-[#111] underline underline-offset-4">Terms of Service</Link>.
				</p>
			</LegalSection>
		</LegalPage>
	);
}
