export const PAGE_PATH = {
	home: "/",
	receipts: "/receipts",
	receiptNew: "/receipts/new",
	receiptDetail: (id: string) => `/receipts/${id}` as const,
	receiptEdit: (id: string) => `/receipts/${id}/edit` as const,
	cashBook: "/cash-book",
	reports: "/reports",
	users: "/settings/users",
	tags: "/settings/tags",
	stores: "/settings/stores",
	settings: "/settings",
} as const;
