import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

const SESSION_STORAGE_KEY = "loci_notification_session";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	global: {
		fetch: (input, init = {}) => {
			const headers = new Headers(input instanceof Request ? input.headers : undefined);
			new Headers(init.headers).forEach((value, key) => headers.set(key, value));
			if (typeof window !== "undefined") {
				try {
					const session = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || "null") as {
						token?: string;
						expiresAt?: string;
					} | null;
					if (session?.token && session.expiresAt && Date.parse(session.expiresAt) > Date.now()) {
						headers.set("x-loci-session", session.token);
					}
				} catch {
					localStorage.removeItem(SESSION_STORAGE_KEY);
				}
			}
			return fetch(input, { ...init, headers });
		},
	},
});