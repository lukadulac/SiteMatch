"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const CLOSED_TAB_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_WRITE_THROTTLE_MS = 30 * 1000;

const LAST_ACTIVITY_STORAGE_KEY = "workbridge_last_activity_at";
const LAST_SEEN_STORAGE_KEY = "workbridge_last_seen_at";
const SESSION_STORAGE_KEY = "workbridge_session_id";

function readTimestamp(key: string) {
	const value = window.localStorage.getItem(key);

	if (!value) {
		return null;
	}

	const timestamp = Number(value);

	return Number.isFinite(timestamp) ? timestamp : null;
}

function writeTimestamp(key: string, timestamp = Date.now()) {
	window.localStorage.setItem(key, String(timestamp));
}

/** The `session_id` claim of a Supabase access token: it changes with every sign-in. */
function readSessionId(accessToken: string) {
	try {
		const payload = JSON.parse(atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));

		return typeof payload.session_id === "string" ? payload.session_id : null;
	} catch {
		return null;
	}
}

export function IdleSessionTimeout() {
	useEffect(() => {
		const supabase = createSupabaseBrowserClient();
		let idleTimerId: number | null = null;
		let lastActivityWriteAt = 0;
		let isSigningOut = false;

		const logoutAndRedirect = () => {
			if (isSigningOut) {
				return;
			}

			isSigningOut = true;
			window.localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
			window.localStorage.removeItem(LAST_SEEN_STORAGE_KEY);
			window.localStorage.removeItem(SESSION_STORAGE_KEY);

			void supabase.auth.signOut().finally(() => {
				// A full page load on purpose: it drops the signed-in user's cached pages from the client router.
				// eslint-disable-next-line @next/next/no-location-assign-relative-destination
				window.location.assign("/login");
			});
		};

		const scheduleIdleLogout = () => {
			if (idleTimerId) {
				window.clearTimeout(idleTimerId);
			}

			const lastActivityAt =
				readTimestamp(LAST_ACTIVITY_STORAGE_KEY) ?? Date.now();
			const remainingMs = IDLE_TIMEOUT_MS - (Date.now() - lastActivityAt);

			if (remainingMs <= 0) {
				logoutAndRedirect();
				return;
			}

			idleTimerId = window.setTimeout(logoutAndRedirect, remainingMs);
		};

		const checkTimeouts = () => {
			const now = Date.now();
			const lastSeenAt = readTimestamp(LAST_SEEN_STORAGE_KEY);
			const lastActivityAt = readTimestamp(LAST_ACTIVITY_STORAGE_KEY);

			if (lastSeenAt && now - lastSeenAt > CLOSED_TAB_TIMEOUT_MS) {
				logoutAndRedirect();
				return;
			}

			if (lastActivityAt && now - lastActivityAt > IDLE_TIMEOUT_MS) {
				logoutAndRedirect();
				return;
			}

			scheduleIdleLogout();
		};

		const recordActivity = () => {
			const now = Date.now();

			if (now - lastActivityWriteAt < ACTIVITY_WRITE_THROTTLE_MS) {
				return;
			}

			lastActivityWriteAt = now;
			writeTimestamp(LAST_ACTIVITY_STORAGE_KEY, now);
			writeTimestamp(LAST_SEEN_STORAGE_KEY, now);
			scheduleIdleLogout();
		};

		const recordLastSeen = () => {
			writeTimestamp(LAST_SEEN_STORAGE_KEY);
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				recordLastSeen();
				return;
			}

			checkTimeouts();
			recordActivity();
		};

		void supabase.auth.getSession().then(({ data: { session } }) => {
			if (!session) {
				return;
			}

			// A new sign-in starts fresh: timestamps left by an earlier session (one that was
			// signed out elsewhere, or expired) must not end this one on its first page load.
			const sessionId = readSessionId(session.access_token);
			if (sessionId && window.localStorage.getItem(SESSION_STORAGE_KEY) !== sessionId) {
				window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
				writeTimestamp(LAST_ACTIVITY_STORAGE_KEY);
				writeTimestamp(LAST_SEEN_STORAGE_KEY);
			}

			checkTimeouts();
			recordActivity();

			window.addEventListener("click", recordActivity);
			window.addEventListener("keydown", recordActivity);
			window.addEventListener("scroll", recordActivity, { passive: true });
			window.addEventListener("touchstart", recordActivity, { passive: true });
			window.addEventListener("mousemove", recordActivity);
			window.addEventListener("pagehide", recordLastSeen);
			document.addEventListener("visibilitychange", handleVisibilityChange);
		});

		return () => {
			if (idleTimerId) {
				window.clearTimeout(idleTimerId);
			}

			window.removeEventListener("click", recordActivity);
			window.removeEventListener("keydown", recordActivity);
			window.removeEventListener("scroll", recordActivity);
			window.removeEventListener("touchstart", recordActivity);
			window.removeEventListener("mousemove", recordActivity);
			window.removeEventListener("pagehide", recordLastSeen);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, []);

	return null;
}
