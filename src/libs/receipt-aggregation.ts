// レシート明細(lines)から親レシート(receipts)の集計値を算出するピュア関数群。
// REQ-RC-04 / REQ-RC-05 に対応。
//
// 設計方針:
//  - 税込金額(amount_tax_incl)を1次情報とし、税額は税込から逆算する
//    （会計ソフト勘定奉行側で税抜化されるため、保存は税込で十分: 打ち合わせ §CSV）
//  - tax_rate は 0 / 8 / 10 のみ許容（軽減税率以外の税率は想定外）
//  - 0件入力はエラー: 1レシート = 必ず1行以上 (REQ-RC-01)

export type ReceiptLineInput = {
	taxRate: 0 | 8 | 10;
	amountTaxIncl: number;
};

export type AggregatedReceipt = {
	amount: number;
	taxAmount: number;
	taxRateCategory: "8" | "10" | "mixed" | null;
};

// 税込金額から消費税額を逆算する。
// tax = amount_tax_incl * rate / (100 + rate)
// 例: 1100円 (10%) → 100円、 540円 (8%) → 40円、 0%なら0円
// 整数化は四捨五入（会計上1円ズレを許容、CSV出力時に勘定奉行側で再計算される前提）
function calcTaxAmount(amountTaxIncl: number, taxRate: number): number {
	if (taxRate === 0) return 0;
	return Math.round((amountTaxIncl * taxRate) / (100 + taxRate));
}

// 全 lines が同一税率なら "8" / "10"、異なるなら "mixed"、
// 全 0% のみなら null（受け皿カラム制約 ('8','10','mixed') に該当値が無いため）。
function resolveCategory(
	lines: ReceiptLineInput[],
): "8" | "10" | "mixed" | null {
	const rates = new Set(lines.map((l) => l.taxRate));
	if (rates.size === 1) {
		const only = lines[0].taxRate;
		if (only === 8) return "8";
		if (only === 10) return "10";
		return null;
	}
	return "mixed";
}

export function aggregateLines(lines: ReceiptLineInput[]): AggregatedReceipt {
	if (lines.length === 0) {
		throw new Error("aggregateLines: 明細が0件です (REQ-RC-01 違反)");
	}
	const amount = lines.reduce((sum, l) => sum + l.amountTaxIncl, 0);
	const taxAmount = lines.reduce(
		(sum, l) => sum + calcTaxAmount(l.amountTaxIncl, l.taxRate),
		0,
	);
	return {
		amount,
		taxAmount,
		taxRateCategory: resolveCategory(lines),
	};
}
