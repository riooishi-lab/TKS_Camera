export const serverEnv = {
	get geminiApiKey() {
		const val = process.env.GEMINI_API_KEY;
		if (!val) throw new Error("GEMINI_API_KEY is not set");
		return val;
	},
} as const;
