import { describe, expect, it } from "vitest";
import {
	applicationStatusMeta,
	canMessageForApplicationStatus,
	canWithdrawForApplicationStatus,
	getApplicationStatusMeta,
} from "@/lib/projects/application-status";

const ALL_STATUSES = [
	"pending",
	"viewed",
	"shortlisted",
	"accepted",
	"rejected",
	"withdrawn",
] as const;

const TERMINAL_STATUSES = ["accepted", "rejected", "withdrawn"] as const;

describe("applicationStatusMeta", () => {
	it("covers every application status", () => {
		expect(Object.keys(applicationStatusMeta).sort()).toEqual(
			[...ALL_STATUSES].sort(),
		);
	});

	it("gives every status a non-empty label and description", () => {
		for (const status of ALL_STATUSES) {
			const meta = getApplicationStatusMeta(status);

			expect(meta.label.length).toBeGreaterThan(0);
			expect(meta.description.length).toBeGreaterThan(0);
		}
	});

	it("closes every action on terminal statuses", () => {
		for (const status of TERMINAL_STATUSES) {
			const meta = getApplicationStatusMeta(status);

			expect(meta.active).toBe(false);
			expect(meta.canReview).toBe(false);
			expect(meta.canShortlist).toBe(false);
			expect(meta.canAccept).toBe(false);
			expect(meta.canReject).toBe(false);
			expect(meta.canWithdraw).toBe(false);
		}
	});

	it("keeps open statuses actionable", () => {
		for (const status of ["pending", "viewed", "shortlisted"] as const) {
			const meta = getApplicationStatusMeta(status);

			expect(meta.active).toBe(true);
			expect(meta.canAccept).toBe(true);
			expect(meta.canReject).toBe(true);
			expect(meta.canWithdraw).toBe(true);
		}
	});

	it("only offers review on a pending application", () => {
		for (const status of ALL_STATUSES) {
			expect(getApplicationStatusMeta(status).canReview).toBe(
				status === "pending",
			);
		}
	});

	it("never offers to shortlist an already shortlisted application", () => {
		expect(getApplicationStatusMeta("shortlisted").canShortlist).toBe(false);
	});
});

describe("messaging and withdrawal gates", () => {
	it("allows messaging until the application is rejected or withdrawn", () => {
		for (const status of ALL_STATUSES) {
			const expected = status !== "rejected" && status !== "withdrawn";

			expect(canMessageForApplicationStatus(status)).toBe(expected);
		}
	});

	it("allows withdrawal only while the application is still open", () => {
		for (const status of ALL_STATUSES) {
			const expected = !TERMINAL_STATUSES.includes(
				status as (typeof TERMINAL_STATUSES)[number],
			);

			expect(canWithdrawForApplicationStatus(status)).toBe(expected);
		}
	});
});
