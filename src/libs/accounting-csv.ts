// 会計ソフト(勘定奉行など)向けの CSV エクスポート生成ロジック。
// 1レシートを line items 単位で展開し、税率/勘定科目ごとに1行ずつ出力する。
// REQ-CSV-01〜06 に対応。
//
// 列構成（暫定 / 顧客から実サンプル受領後に最終調整）:
//   伝票日付, 店舗名, 勘定科目, 税込金額, 税率, インボイス区分,
//   摘要, 品目, 支払区分, レシートID, ライン番号
//
// 実フォーマット確定までは feature flag で UI を隠す前提（REQ-CSV-06）。

import type { Receipt, ReceiptLine, Store } from "./storage";

export type CsvExportInput = {
	receipts: Receipt[];
	lines: ReceiptLine[];
	stores: Store[];
};

const CSV_HEADER = [
	"伝票日付",
	"店舗名",
	"勘定科目",
	"税込金額",
	"税率",
	"インボイス区分",
	"摘要",
	"品目",
	"支払区分",
	"レシートID",
	"ライン番号",
] as const;

const INVOICE_STATUS_LABEL: Record<string, string> = {
	registered: "登録あり",
	unregistered: "登録なし（80%控除）",
	unknown: "不明",
};

const EXPENSE_TYPE_LABEL: Record<string, string> = {
	petty_cash: "小口現金",
	personal: "店長立替（給与振込）",
};

// CSV エクスポート対象のステータス。
// 経理承認済み と 支払済 のみ会計ソフトに連携する (REQ-CSV-02)。
export function isCsvExportable(receipt: Receipt): boolean {
	return receipt.status === "accountant_approved" || receipt.status === "paid";
}

// 月・店舗フィルタを適用して書き出す行を組み立てる。
// month: "YYYY-MM" 形式、未指定で全期間。
// storeId: 未指定で全店舗。
export function buildAccountingCsvRows(
	input: CsvExportInput,
	filter: { month?: string; storeId?: string },
): string[][] {
	const storeMap = new Map(input.stores.map((s) => [s.id, s.name]));
	// receipt_id => 該当 receipt の lines （line_no 昇順）
	const linesByReceipt = new Map<string, ReceiptLine[]>();
	for (const l of input.lines) {
		const arr = linesByReceipt.get(l.receiptId) ?? [];
		arr.push(l);
		linesByReceipt.set(l.receiptId, arr);
	}
	for (const arr of linesByReceipt.values()) {
		arr.sort((a, b) => a.lineNo - b.lineNo);
	}

	const rows: string[][] = [CSV_HEADER.slice() as unknown as string[]];

	// 伝票日付の昇順で安定したCSVにする
	const sortedReceipts = [...input.receipts]
		.filter(isCsvExportable)
		.filter((r) => {
			if (filter.month && (!r.date || r.date.slice(0, 7) !== filter.month))
				return false;
			if (filter.storeId && r.storeId !== filter.storeId) return false;
			return true;
		})
		.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

	for (const r of sortedReceipts) {
		const lines = linesByReceipt.get(r.id) ?? [];
		// lines が空のレシートでも1行は出力する（既存データのバックフィル不整合への保険）
		if (lines.length === 0) {
			rows.push(
				buildSingleRow({
					date: r.date ?? "",
					storeName: r.storeId ? (storeMap.get(r.storeId) ?? "") : "",
					category: r.accountCategory ?? "",
					amount: r.amount ?? 0,
					taxRate: taxCategoryToRateLabel(r.taxRateCategory),
					invoiceStatus: r.invoiceStatus,
					description: r.description ?? "",
					itemName: r.itemName ?? "",
					expenseType: r.expenseType,
					receiptId: r.id,
					lineNo: 1,
				}),
			);
			continue;
		}
		for (const l of lines) {
			rows.push(
				buildSingleRow({
					date: r.date ?? "",
					storeName: r.storeId ? (storeMap.get(r.storeId) ?? "") : "",
					category: l.accountCategory,
					amount: l.amountTaxIncl,
					taxRate: `${l.taxRate}%`,
					// 明細単位の invoice_eligible が無効の行は「登録なし」扱いに上書き
					invoiceStatus: l.invoiceEligible ? r.invoiceStatus : "unregistered",
					description: r.description ?? "",
					itemName: l.itemName ?? r.itemName ?? "",
					expenseType: r.expenseType,
					receiptId: r.id,
					lineNo: l.lineNo,
				}),
			);
		}
	}
	return rows;
}

function buildSingleRow(p: {
	date: string;
	storeName: string;
	category: string;
	amount: number;
	taxRate: string;
	invoiceStatus: string;
	description: string;
	itemName: string;
	expenseType: string;
	receiptId: string;
	lineNo: number;
}): string[] {
	return [
		p.date,
		p.storeName,
		p.category,
		String(p.amount),
		p.taxRate,
		INVOICE_STATUS_LABEL[p.invoiceStatus] ?? p.invoiceStatus,
		p.description,
		p.itemName,
		EXPENSE_TYPE_LABEL[p.expenseType] ?? p.expenseType,
		p.receiptId,
		String(p.lineNo),
	];
}

function taxCategoryToRateLabel(cat: "8" | "10" | "mixed" | null): string {
	if (cat === "8") return "8%";
	if (cat === "10") return "10%";
	if (cat === "mixed") return "混在";
	return "";
}

// ファイル名規約: keihi_{YYYYMM}_{店舗 or all}.csv (REQ-CSV-05)
export function buildExportFilename(filter: {
	month?: string;
	storeName?: string;
}): string {
	const ym = filter.month ? filter.month.replace("-", "") : "all";
	const store = filter.storeName ?? "all";
	return `keihi_${ym}_${store}.csv`;
}
