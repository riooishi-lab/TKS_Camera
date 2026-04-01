export const PAGE_PATH = {
	home: "/",
	receipts: "/receipts",
	receiptNew: "/receipts/new",
	receiptDetail: (id: string) => `/receipts/${id}` as const,
	receiptEdit: (id: string) => `/receipts/${id}/edit` as const,
	projects: "/projects",
	settings: "/settings",
	signIn: "/auth/signin",
	signUp: "/auth/signup",
} as const;
