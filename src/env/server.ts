export const serverEnv = (() => {
	const geminiApiKey = process.env.GEMINI_API_KEY;
	if (!geminiApiKey) {
		throw new Error("GEMINI_API_KEY is not set");
	}

	return {
		geminiApiKey,
	} as const;
})();
