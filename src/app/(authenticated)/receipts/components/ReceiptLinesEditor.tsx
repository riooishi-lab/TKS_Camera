"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { ACCOUNT_CATEGORIES } from "@/constants/accountCategories";
import { aggregateLines } from "@/libs/receipt-aggregation";
import { formatCurrency } from "@/utils/formatCurrency";

// 入力中の lines は受け付け側で空文字も保持できるようゆるい型で扱う。
// 保存時に呼び出し側で normalizeLines を通して厳格な型に変換する。
export type DraftLine = {
	taxRate: "0" | "8" | "10" | "";
	amountTaxIncl: string;
	accountCategory: string;
	itemName: string;
	invoiceEligible: boolean;
};

export function emptyDraftLine(): DraftLine {
	return {
		taxRate: "10",
		amountTaxIncl: "",
		accountCategory: "雑費",
		itemName: "",
		invoiceEligible: true,
	};
}

// 厳格化: 空欄や不正値は破棄しつつ、最低1件は残す。
// 全行が空の場合は呼び出し側でバリデーションエラーとして拾うこと（戻り値は空配列）。
export function normalizeLines(drafts: DraftLine[]): Array<{
	taxRate: 0 | 8 | 10;
	amountTaxIncl: number;
	accountCategory: string;
	itemName: string | null;
	invoiceEligible: boolean;
}> {
	return drafts
		.map((d) => {
			const taxRate =
				d.taxRate === "" ? null : (Number(d.taxRate) as 0 | 8 | 10);
			const amountTaxIncl = d.amountTaxIncl ? Number(d.amountTaxIncl) : null;
			if (taxRate == null || !Number.isFinite(amountTaxIncl as number))
				return null;
			return {
				taxRate,
				amountTaxIncl: Math.round(amountTaxIncl as number),
				accountCategory: d.accountCategory || "雑費",
				itemName: d.itemName.trim() || null,
				invoiceEligible: d.invoiceEligible,
			};
		})
		.filter((l): l is NonNullable<typeof l> => l !== null);
}

export function ReceiptLinesEditor({
	value,
	onChange,
}: {
	value: DraftLine[];
	onChange: (next: DraftLine[]) => void;
}) {
	const update = (idx: number, patch: Partial<DraftLine>) => {
		onChange(value.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
	};
	const remove = (idx: number) => {
		if (value.length <= 1) return; // 1行は必ず残す (REQ-RC-01)
		onChange(value.filter((_, i) => i !== idx));
	};
	const add = () => {
		onChange([...value, emptyDraftLine()]);
	};

	// プレビュー集計（normalize後の値ベース）
	const normalized = normalizeLines(value);
	const summary = normalized.length > 0 ? aggregateLines(normalized) : null;

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<Label>明細</Label>
				<Button type="button" size="sm" variant="outline" onClick={add}>
					<Plus className="mr-1.5 h-3.5 w-3.5" />
					行を追加
				</Button>
			</div>
			<div className="overflow-x-auto rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-20">税率</TableHead>
							<TableHead className="w-32">税込金額</TableHead>
							<TableHead className="w-40">勘定科目</TableHead>
							<TableHead>品目</TableHead>
							<TableHead className="w-16">インボ</TableHead>
							<TableHead className="w-10" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{value.map((line, idx) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: order-stable list bound to React state index
							<TableRow key={idx}>
								<TableCell>
									<NativeSelect
										value={line.taxRate}
										onChange={(e) =>
											update(idx, {
												taxRate: e.target.value as DraftLine["taxRate"],
											})
										}
										options={[
											{ value: "10", label: "10%" },
											{ value: "8", label: "8%" },
											{ value: "0", label: "非課税" },
										]}
									/>
								</TableCell>
								<TableCell>
									<Input
										type="number"
										value={line.amountTaxIncl}
										onChange={(e) =>
											update(idx, { amountTaxIncl: e.target.value })
										}
										placeholder="0"
										className="h-8"
									/>
								</TableCell>
								<TableCell>
									<NativeSelect
										value={line.accountCategory}
										onChange={(e) =>
											update(idx, { accountCategory: e.target.value })
										}
										options={ACCOUNT_CATEGORIES.map((c) => ({
											value: c.value,
											label: c.label,
										}))}
									/>
								</TableCell>
								<TableCell>
									<Input
										value={line.itemName}
										onChange={(e) => update(idx, { itemName: e.target.value })}
										placeholder="例: 弁当, 文具一式"
										className="h-8"
									/>
								</TableCell>
								<TableCell className="text-center">
									<input
										type="checkbox"
										checked={line.invoiceEligible}
										onChange={(e) =>
											update(idx, { invoiceEligible: e.target.checked })
										}
										aria-label="インボイス対象"
									/>
								</TableCell>
								<TableCell>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										onClick={() => remove(idx)}
										disabled={value.length <= 1}
										title={value.length <= 1 ? "明細は最低1行必要です" : "削除"}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
			{summary && (
				<div className="flex flex-wrap gap-x-4 gap-y-1 px-1 pt-1 text-xs text-muted-foreground">
					<span>
						合計（税込）:{" "}
						<span className="font-semibold text-foreground">
							{formatCurrency(summary.amount)}
						</span>
					</span>
					<span>
						消費税額:{" "}
						<span className="font-semibold text-foreground">
							{formatCurrency(summary.taxAmount)}
						</span>
					</span>
					<span>
						税率区分:{" "}
						<span className="font-semibold text-foreground">
							{summary.taxRateCategory === "mixed"
								? "混在"
								: summary.taxRateCategory === "10"
									? "10%"
									: summary.taxRateCategory === "8"
										? "8%"
										: "非課税"}
						</span>
					</span>
				</div>
			)}
		</div>
	);
}
