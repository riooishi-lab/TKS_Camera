export const clientEnv = {
	get supabaseUrl() {
		const val = process.env.NEXT_PUBLIC_SUPABASE_URL;
		if (!val) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
		return val;
	},
	get supabaseAnonKey() {
		const val = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
		if (!val) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
		return val;
	},
} as const;
