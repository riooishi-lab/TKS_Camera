// 会計CSVエクスポートの単体テスト。
// 実行: `node --test --experimental-strip-types src/libs/accounting-csv.test.ts`
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	buildAccountingCsvRows,
	buildExportFilename,
	isCsvExportable,
} from "./accounting-csv.ts";
import type { Receipt, ReceiptLine, Store } from "./storage.ts";

function makeReceipt(overrides: Partial<Receipt>): Receipt {
	return {
		id: overrides.id ?? "r1",
		storeId: overrides.storeId ?? "s1",
		status: overrides.status ?? "accountant_approved",
		date: overrides.date ?? "2026-05-15",
		payee: overrides.payee ?? "テスト商店",
		amount: overrides.amount ?? 1100,
		taxAmount: overrides.taxAmount ?? 100,
		taxRateCategory: overrides.taxRateCategory ?? "10",
		accountCategory: overrides.accountCategory ?? "消耗品費",
		description: overrides.description ?? null,
		invoiceRegistrationNo: overrides.invoiceRegistrationNo ?? null,
		purpose: overrides.purpose ?? null,
		participants: overrides.participants ?? null,
		imageUrl: overrides.imageUrl ?? "",
		aiRawResponse: null,
		aiConfidence: null,
		isAiVerified: true,
		managerApprovedBy: null,
		managerApprovedAt: null,
		accountantApprovedBy: null,
		accountantApprovedAt: null,
		presidentApprovedBy: null,
		presidentApprovedAt: null,
		rejectionReason: null,
		paidBy: null,
		paidAt: null,
		createdBy: null,
		updatedBy: null,
		createdAt: "2026-05-15T00:00:00Z",
		updatedAt: "2026-05-15T00:00:00Z",
		submittedAt: overrides.submittedAt ?? "2026-05-15T00:00:00Z",
		expenseType: overrides.expenseType ?? "petty_cash",
		invoiceStatus: overrides.invoiceStatus ?? "registered",
		itemName: overrides.itemName ?? null,
		imageMetadata: null,
	};
}

function makeLine(overrides: Partial<ReceiptLine>): ReceiptLine {
	return {
		id: overrides.id ?? "l1",
		receiptId: overrides.receiptId ?? "r1",
		lineNo: overrides.lineNo ?? 1,
		taxRate: overrides.taxRate ?? 10,
		amountTaxIncl: overrides.amountTaxIncl ?? 1100,
		accountCategory: overrides.accountCategory ?? "消耗品費",
		itemName: overrides.itemName ?? null,
		invoiceEligible: overrides.invoiceEligible ?? true,
		createdAt: "2026-05-15T00:00:00Z",
	};
}

const stores: Store[] = [
	{ id: "s1", name: "渋谷店", createdAt: "" },
	{ id: "s2", name: "新宿店", createdAt: "" },
];

describe("isCsvExportable", () => {
	it("accountant_approved と paid のみエクスポート対象", () => {
		assert.equal(
			isCsvExportable(makeReceipt({ status: "accountant_approved" })),
			true,
		);
		assert.equal(isCsvExportable(makeReceipt({ status: "paid" })), true);
		assert.equal(isCsvExportable(makeReceipt({ status: "pending" })), false);
		assert.equal(
			isCsvExportable(makeReceipt({ status: "manager_approved" })),
			false,
		);
		assert.equal(isCsvExportable(makeReceipt({ status: "rejected" })), false);
	});
});

describe("buildAccountingCsvRows", () => {
	it("ヘッダ行が常に先頭にあり11列ある", () => {
		const rows = buildAccountingCsvRows(
			{ receipts: [], lines: [], stores },
			{},
		);
		assert.equal(rows.length, 1);
		assert.equal(rows[0].length, 11);
		assert.deepEqual(rows[0], [
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
		]);
	});

	it("単一明細レシートは1行展開される", () => {
		const r = makeReceipt({ id: "r1" });
		const l = makeLine({ receiptId: "r1" });
		const rows = buildAccountingCsvRows(
			{ receipts: [r], lines: [l], stores },
			{},
		);
		assert.equal(rows.length, 2); // header + 1
		assert.equal(rows[1][0], "2026-05-15");
		assert.equal(rows[1][1], "渋谷店");
		assert.equal(rows[1][3], "1100");
		assert.equal(rows[1][4], "10%");
		assert.equal(rows[1][5], "登録あり");
		assert.equal(rows[1][8], "小口現金");
		assert.equal(rows[1][9], "r1");
		assert.equal(rows[1][10], "1");
	});

	it("税率混在レシートは明細ごとに2行展開される", () => {
		const r = makeReceipt({ id: "r1", taxRateCategory: "mixed", amount: 1640 });
		const lines = [
			makeLine({
				id: "l1",
				receiptId: "r1",
				lineNo: 1,
				taxRate: 10,
				amountTaxIncl: 1100,
				accountCategory: "消耗品費",
			}),
			makeLine({
				id: "l2",
				receiptId: "r1",
				lineNo: 2,
				taxRate: 8,
				amountTaxIncl: 540,
				accountCategory: "福利厚生費",
			}),
		];
		const rows = buildAccountingCsvRows({ receipts: [r], lines, stores }, {});
		assert.equal(rows.length, 3);
		assert.equal(rows[1][2], "消耗品費");
		assert.equal(rows[1][4], "10%");
		assert.equal(rows[1][3], "1100");
		assert.equal(rows[2][2], "福利厚生費");
		assert.equal(rows[2][4], "8%");
		assert.equal(rows[2][3], "540");
	});

	it("status が未承認のレシートは除外される", () => {
		const r = makeReceipt({ id: "r1", status: "pending" });
		const l = makeLine({ receiptId: "r1" });
		const rows = buildAccountingCsvRows(
			{ receipts: [r], lines: [l], stores },
			{},
		);
		assert.equal(rows.length, 1); // ヘッダのみ
	});

	it("月フィルタで対象月のみ出力", () => {
		const r1 = makeReceipt({ id: "r1", date: "2026-05-15" });
		const r2 = makeReceipt({ id: "r2", date: "2026-06-15" });
		const l1 = makeLine({ id: "l1", receiptId: "r1" });
		const l2 = makeLine({ id: "l2", receiptId: "r2" });
		const rows = buildAccountingCsvRows(
			{ receipts: [r1, r2], lines: [l1, l2], stores },
			{ month: "2026-05" },
		);
		assert.equal(rows.length, 2);
		assert.equal(rows[1][9], "r1");
	});

	it("店舗フィルタで該当店舗のみ出力", () => {
		const r1 = makeReceipt({ id: "r1", storeId: "s1" });
		const r2 = makeReceipt({ id: "r2", storeId: "s2" });
		const l1 = makeLine({ id: "l1", receiptId: "r1" });
		const l2 = makeLine({ id: "l2", receiptId: "r2" });
		const rows = buildAccountingCsvRows(
			{ receipts: [r1, r2], lines: [l1, l2], stores },
			{ storeId: "s1" },
		);
		assert.equal(rows.length, 2);
		assert.equal(rows[1][1], "渋谷店");
	});

	it("店長立替は支払区分列が「店長立替（給与振込）」になる", () => {
		const r = makeReceipt({ id: "r1", expenseType: "personal" });
		const l = makeLine({ receiptId: "r1" });
		const rows = buildAccountingCsvRows(
			{ receipts: [r], lines: [l], stores },
			{},
		);
		assert.equal(rows[1][8], "店長立替（給与振込）");
	});

	it("インボイス区分: 親が registered でも明細の invoice_eligible=false なら unregistered で出力", () => {
		const r = makeReceipt({ id: "r1", invoiceStatus: "registered" });
		const l = makeLine({ receiptId: "r1", invoiceEligible: false });
		const rows = buildAccountingCsvRows(
			{ receipts: [r], lines: [l], stores },
			{},
		);
		assert.equal(rows[1][5], "登録なし（80%控除）");
	});

	it("複数レシートは伝票日付の昇順で出力", () => {
		const r1 = makeReceipt({ id: "r1", date: "2026-05-15" });
		const r2 = makeReceipt({ id: "r2", date: "2026-05-10" });
		const r3 = makeReceipt({ id: "r3", date: "2026-05-20" });
		const l1 = makeLine({ id: "l1", receiptId: "r1" });
		const l2 = makeLine({ id: "l2", receiptId: "r2" });
		const l3 = makeLine({ id: "l3", receiptId: "r3" });
		const rows = buildAccountingCsvRows(
			{ receipts: [r1, r2, r3], lines: [l1, l2, l3], stores },
			{},
		);
		assert.equal(rows[1][9], "r2"); // 2026-05-10
		assert.equal(rows[2][9], "r1"); // 2026-05-15
		assert.equal(rows[3][9], "r3"); // 2026-05-20
	});
});

describe("buildExportFilename", () => {
	it("月・店舗指定なしで keihi_all_all.csv", () => {
		assert.equal(buildExportFilename({}), "keihi_all_all.csv");
	});
	it("月指定で keihi_YYYYMM_all.csv", () => {
		assert.equal(
			buildExportFilename({ month: "2026-05" }),
			"keihi_202605_all.csv",
		);
	});
	it("月・店舗指定で keihi_YYYYMM_{店舗}.csv", () => {
		assert.equal(
			buildExportFilename({ month: "2026-05", storeName: "渋谷店" }),
			"keihi_202605_渋谷店.csv",
		);
	});
});
