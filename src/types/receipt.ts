// Phase 5: 明細(lines) を返すよう拡張。
// 後方互換のため、AI が lines を返さなかった場合の従来フィールドも残置。
// クライアント側で lines が空配列のときは従来フィールドから1行を合成する。
export type ReceiptExtractionLine = {
	taxRate: 0 | 8 | 10;
	amountTaxIncl: number;
	accountCategory: string | null;
	itemName: string | null;
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
	// Phase 5: 明細配列。レシート内に税率/勘定科目混在があれば複数行になる。
	// 単一税率・単一勘定なら1行。常に1件以上を期待。
	lines: ReceiptExtractionLine[];
};
