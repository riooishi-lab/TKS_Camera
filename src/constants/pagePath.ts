export const PAGE_PATH = {
	home: "/",
	receipts: "/receipts",
	receiptNew: "/receipts/new",
	receiptDetail: (id: string) => `/receipts/${id}` as const,
	receiptEdit: (id: string) => `/receipts/${id}/edit` as const,
	projects: "/projects",
	clients: "/clients",
	staff: "/staff",
	reports: "/reports",
	users: "/settings/users",
	tags: "/settings/tags",
	settings: "/settings",
} as const;
