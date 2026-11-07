import type { Database } from "@/types/supabase";

export type ApplicationStatus =
	Database["public"]["Enums"]["application_status"];

type ApplicationStatusMeta = {
	label: string;
	description: string;
	active: boolean;
	canReview: boolean;
	canMessage: boolean;
	canShortlist: boolean;
	canReject: boolean;
	canAccept: boolean;
	canWithdraw: boolean;
};

export const applicationStatusMeta = {
	pending: {
		label: "Pending",
		description: "Not reviewed yet.",
		active: true,
		canReview: true,
		canMessage: true,
		canShortlist: true,
		canReject: true,
		canAccept: true,
		canWithdraw: true,
	},
	viewed: {
		label: "Viewed",
		description: "Reviewed by you.",
		active: true,
		canReview: false,
		canMessage: true,
		canShortlist: true,
		canReject: true,
		canAccept: true,
		canWithdraw: true,
	},
	shortlisted: {
		label: "Shortlisted",
		description: "Still being considered.",
		active: true,
		canReview: false,
		canMessage: true,
		canShortlist: false,
		canReject: true,
		canAccept: true,
		canWithdraw: true,
	},
	accepted: {
		label: "Accepted",
		description: "Selected for this project.",
		active: false,
		canReview: false,
		canMessage: true,
		canShortlist: false,
		canReject: false,
		canAccept: false,
		canWithdraw: false,
	},
	rejected: {
		label: "Rejected",
		description: "Closed by you.",
		active: false,
		canReview: false,
		canMessage: false,
		canShortlist: false,
		canReject: false,
		canAccept: false,
		canWithdraw: false,
	},
	withdrawn: {
		label: "Withdrawn",
		description: "Withdrawn by provider.",
		active: false,
		canReview: false,
		canMessage: false,
		canShortlist: false,
		canReject: false,
		canAccept: false,
		canWithdraw: false,
	},
} satisfies Record<ApplicationStatus, ApplicationStatusMeta>;

export function getApplicationStatusMeta(status: ApplicationStatus) {
	return applicationStatusMeta[status];
}

export function canMessageForApplicationStatus(status: ApplicationStatus) {
	return applicationStatusMeta[status].canMessage;
}

export function canWithdrawForApplicationStatus(status: ApplicationStatus) {
	return applicationStatusMeta[status].canWithdraw;
}
