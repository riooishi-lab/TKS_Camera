export type Receipt = {
	id: string;
	organizationId: string;
	uploadedBy: string;
	date: string | null;
	payee: string | null;
	amount: number | null;
	taxAmount: number | null;
	taxRateCategory: "8" | "10" | "mixed" | null;
	accountCategory: string | null;
	description: string | null;
	invoiceRegistrationNo: string | null;
	projectId: string | null;
	clientId: string | null;
	personInCharge: string | null;
	imageUrl: string;
	imagePath: string;
	aiRawResponse: Record<string, unknown> | null;
	aiConfidence: number | null;
	isAiVerified: boolean;
	createdAt: string;
	updatedAt: string;
};

export type ReceiptExtraction = {
	date: string | null;
	payee: string | null;
	amount: number | null;
	taxAmount: number | null;
	taxRateCategory: "8" | "10" | "mixed" | null;
	accountCategory: string | null;
	description: string | null;
	invoiceRegistrationNo: string | null;
	confidence: number;
};
