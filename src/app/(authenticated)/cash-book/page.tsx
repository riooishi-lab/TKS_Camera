"use client";

import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
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
import { useAuth } from "@/contexts/AuthContext";
import {
	type CashDeposit,
	deleteCashDeposit,
	getCashDeposits,
	getReceipts,
	getStores,
	type Receipt,
	type Store,
	saveCashDeposit,
} from "@/libs/storage";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

type LedgerRow = {
	kind: "deposit" | "expense";
	id: string;
	date: string;
	content: string;
	purpose: string;
	deposit: number;
	withdrawal: number;
	categoryAmounts: Record<string, number>;
	deletable: boolean;
};

function currentYearMonth(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ymRange(ym: string): { start: string; end: string } {
	const [y, m] = ym.split("-").map(Number);
	const start = `${y}-${String(m).padStart(2, "0")}-01`;
	const lastDay = new Date(y, m, 0).getDate();
	const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
	return { start, end };
}

export default function CashBookPage() {
	const { tksUser } = useAuth();
	const [stores, setStores] = useState<Store[]>([]);
	const [receipts, setReceipts] = useState<Receipt[]>([]);
	const [deposits, setDeposits] = useState<CashDeposit[]>([]);
	const [storeId, setStoreId] = useState("");
	const [yearMonth, setYearMonth] = useState(currentYearMonth());
	const [depositOpen, setDepositOpen] = useState(false);
	const [depositError, setDepositError] = useState<string | null>(null);

	const role = tksUser?.role;
	const canRecordDeposit = role === "hq_accountant" || role === "president";

	const reload = useCallback(async () => {
		const [r, d, s] = await Promise.all([
			getReceipts(),
			getCashDeposits(),
			getStores(),
		]);
		setReceipts(r);
		setDeposits(d);
		setStores(s);
	}, []);

	useEffect(() => {
		reload();
	}, [reload]);

	// 初期店舗: store_managerは自店舗、それ以外は最初の店舗
	useEffect(() => {
		if (!storeId && stores.length > 0) {
			if (tksUser?.storeId) {
				setStoreId(tksUser.storeId);
			} else {
				setStoreId(stores[0].id);
			}
		}
	}, [stores, storeId, tksUser?.storeId]);

	const { start, end } = ymRange(yearMonth);

	// 店舗フィルタ（store_managerは自店舗固定）
	const effectiveStoreId =
		role === "store_manager" ? (tksUser?.storeId ?? "") : storeId;

	// 当月の入金/出金を抽出（出金 = 当月内のレシート、状態は問わず実際の現金移動を反映）
	const monthDeposits = deposits.filter(
		(d) => d.storeId === effectiveStoreId && d.date >= start && d.date <= end,
	);
	const monthReceipts = receipts.filter(
		(r) =>
			r.storeId === effectiveStoreId &&
			r.date != null &&
			r.date >= start &&
			r.date <= end,
	);

	// 前月までの繰越残高 = (全期間の入金 - 当該店舗の出金) で 当月開始日より前
	const carryForward =
		deposits
			.filter((d) => d.storeId === effectiveStoreId && d.date < start)
			.reduce((sum, d) => sum + d.amount, 0) -
		receipts
			.filter(
				(r) =>
					r.storeId === effectiveStoreId &&
					r.date != null &&
					r.date < start &&
					r.amount != null,
			)
			.reduce((sum, r) => sum + (r.amount ?? 0), 0);

	// 行の組み立て: 入金 + 出金 を日付順
	const rows: LedgerRow[] = useMemoBuildRows(monthDeposits, monthReceipts);

	if (role === "staff") {
		return (
			<div className="py-12 text-center text-muted-foreground">
				このページにはアクセスできません
			</div>
		);
	}

	// 累計残高
	let runningBalance = carryForward;
	const rowsWithBalance = rows.map((row) => {
		runningBalance += row.deposit - row.withdrawal;
		return { ...row, balance: runningBalance };
	});

	const totalDeposit = monthDeposits.reduce((sum, d) => sum + d.amount, 0);
	const totalWithdrawal = monthReceipts.reduce(
		(sum, r) => sum + (r.amount ?? 0),
		0,
	);
	const closingBalance = carryForward + totalDeposit - totalWithdrawal;

	// 勘定科目別合計
	const categoryTotals = ACCOUNT_CATEGORIES.reduce(
		(acc, c) => {
			acc[c.value] = monthReceipts
				.filter((r) => r.accountCategory === c.value)
				.reduce((sum, r) => sum + (r.amount ?? 0), 0);
			return acc;
		},
		{} as Record<string, number>,
	);
	const otherTotal = monthReceipts
		.filter(
			(r) =>
				!r.accountCategory ||
				!ACCOUNT_CATEGORIES.some((c) => c.value === r.accountCategory),
		)
		.reduce((sum, r) => sum + (r.amount ?? 0), 0);

	const handleSaveDeposit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setDepositError(null);
		const fd = new FormData(e.currentTarget);
		const amountStr = fd.get("amount") as string;
		const amount = Number.parseInt(amountStr, 10);
		if (!Number.isFinite(amount) || amount <= 0) {
			setDepositError("金額は正の数を入力してください");
			return;
		}
		try {
			await saveCashDeposit({
				storeId: effectiveStoreId,
				date: fd.get("date") as string,
				amount,
				description: ((fd.get("description") as string) || "").trim() || null,
				createdBy: tksUser?.id ?? null,
			});
			setDepositOpen(false);
			await reload();
		} catch (err) {
			setDepositError(
				err instanceof Error ? err.message : "登録に失敗しました",
			);
		}
	};

	const handleDeleteDeposit = async (id: string) => {
		await deleteCashDeposit(id);
		await reload();
	};

	return (
		<div>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">小口現金帳</h1>
				<div className="flex flex-wrap items-center gap-2">
					<NativeSelect
						value={effectiveStoreId}
						onChange={(e) => setStoreId(e.target.value)}
						placeholder="店舗"
						options={stores.map((s) => ({ value: s.id, label: s.name }))}
						disabled={role === "store_manager"}
					/>
					<Input
						type="month"
						value={yearMonth}
						onChange={(e) => setYearMonth(e.target.value)}
						className="h-8 w-40"
					/>
					{canRecordDeposit && effectiveStoreId && (
						<Dialog
							open={depositOpen}
							onOpenChange={(v) => {
								setDepositOpen(v);
								if (!v) setDepositError(null);
							}}
						>
							<DialogTrigger render={<Button size="sm" />}>
								<Plus className="mr-1.5 h-4 w-4" />
								入金記録
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>入金を記録</DialogTitle>
								</DialogHeader>
								<form onSubmit={handleSaveDeposit} className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="deposit-date">日付</Label>
										<Input
											id="deposit-date"
											name="date"
											type="date"
											defaultValue={new Date().toISOString().slice(0, 10)}
											required
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="deposit-amount">金額</Label>
										<Input
											id="deposit-amount"
											name="amount"
											type="number"
											required
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="deposit-desc">摘要（任意）</Label>
										<Input
											id="deposit-desc"
											name="description"
											placeholder="例: 補充金"
										/>
									</div>
									{depositError && (
										<p className="text-sm text-destructive">{depositError}</p>
									)}
									<DialogFooter>
										<Button
											type="button"
											variant="outline"
											onClick={() => setDepositOpen(false)}
										>
											キャンセル
										</Button>
										<Button type="submit">登録</Button>
									</DialogFooter>
								</form>
							</DialogContent>
						</Dialog>
					)}
				</div>
			</div>

			{/* サマリー */}
			<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
				<SummaryCard label="前月繰越" value={formatCurrency(carryForward)} />
				<SummaryCard label="当月入金" value={formatCurrency(totalDeposit)} />
				<SummaryCard label="当月出金" value={formatCurrency(totalWithdrawal)} />
				<SummaryCard label="月末残高" value={formatCurrency(closingBalance)} />
			</div>

			{/* 元帳 */}
			<Card className="mt-6">
				<CardHeader>
					<CardTitle className="text-lg">明細</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-24">日付</TableHead>
									<TableHead>内容</TableHead>
									<TableHead>目的</TableHead>
									<TableHead className="text-right">入金</TableHead>
									<TableHead className="text-right">出金</TableHead>
									<TableHead className="text-right">残高</TableHead>
									{ACCOUNT_CATEGORIES.map((c) => (
										<TableHead
											key={c.value}
											className="text-right whitespace-nowrap"
										>
											{c.label}
										</TableHead>
									))}
									<TableHead className="text-right">その他</TableHead>
									<TableHead className="w-12" />
								</TableRow>
							</TableHeader>
							<TableBody>
								<TableRow>
									<TableCell colSpan={5} className="text-muted-foreground">
										前月繰越
									</TableCell>
									<TableCell className="text-right font-medium">
										{formatCurrency(carryForward)}
									</TableCell>
									<TableCell colSpan={ACCOUNT_CATEGORIES.length + 2} />
								</TableRow>
								{rowsWithBalance.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={ACCOUNT_CATEGORIES.length + 8}
											className="text-center text-muted-foreground"
										>
											該当月のデータがありません
										</TableCell>
									</TableRow>
								) : (
									rowsWithBalance.map((row) => (
										<TableRow key={`${row.kind}-${row.id}`}>
											<TableCell>{formatDate(row.date)}</TableCell>
											<TableCell>{row.content}</TableCell>
											<TableCell>{row.purpose}</TableCell>
											<TableCell className="text-right">
												{row.deposit > 0 ? formatCurrency(row.deposit) : ""}
											</TableCell>
											<TableCell className="text-right">
												{row.withdrawal > 0
													? formatCurrency(row.withdrawal)
													: ""}
											</TableCell>
											<TableCell className="text-right font-medium">
												{formatCurrency(row.balance)}
											</TableCell>
											{ACCOUNT_CATEGORIES.map((c) => (
												<TableCell
													key={c.value}
													className="text-right text-muted-foreground"
												>
													{row.categoryAmounts[c.value] > 0
														? formatCurrency(row.categoryAmounts[c.value])
														: ""}
												</TableCell>
											))}
											<TableCell className="text-right text-muted-foreground">
												{row.categoryAmounts.__other > 0
													? formatCurrency(row.categoryAmounts.__other)
													: ""}
											</TableCell>
											<TableCell>
												{row.deletable && canRecordDeposit && (
													<Button
														variant="ghost"
														size="icon"
														onClick={() => handleDeleteDeposit(row.id)}
														title="入金を削除"
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												)}
											</TableCell>
										</TableRow>
									))
								)}
								{/* 合計行 */}
								<TableRow className="font-medium">
									<TableCell colSpan={3} className="text-right">
										合計
									</TableCell>
									<TableCell className="text-right">
										{formatCurrency(totalDeposit)}
									</TableCell>
									<TableCell className="text-right">
										{formatCurrency(totalWithdrawal)}
									</TableCell>
									<TableCell className="text-right">
										{formatCurrency(closingBalance)}
									</TableCell>
									{ACCOUNT_CATEGORIES.map((c) => (
										<TableCell key={c.value} className="text-right">
											{categoryTotals[c.value] > 0
												? formatCurrency(categoryTotals[c.value])
												: ""}
										</TableCell>
									))}
									<TableCell className="text-right">
										{otherTotal > 0 ? formatCurrency(otherTotal) : ""}
									</TableCell>
									<TableCell />
								</TableRow>
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

function useMemoBuildRows(
	deposits: CashDeposit[],
	receipts: Receipt[],
): LedgerRow[] {
	return useMemo(() => {
		const list: LedgerRow[] = [];
		for (const d of deposits) {
			list.push({
				kind: "deposit",
				id: d.id,
				date: d.date,
				content: d.description ?? "入金",
				purpose: "",
				deposit: d.amount,
				withdrawal: 0,
				categoryAmounts: {},
				deletable: true,
			});
		}
		for (const r of receipts) {
			if (!r.date) continue;
			const cat = r.accountCategory;
			const isKnown =
				cat != null && ACCOUNT_CATEGORIES.some((c) => c.value === cat);
			const amount = r.amount ?? 0;
			list.push({
				kind: "expense",
				id: r.id,
				date: r.date,
				content: r.payee ?? "-",
				purpose: r.purpose ?? "",
				deposit: 0,
				withdrawal: amount,
				categoryAmounts: isKnown
					? { [cat as string]: amount }
					: { __other: amount },
				deletable: false,
			});
		}
		list.sort((a, b) => {
			if (a.date !== b.date) return a.date.localeCompare(b.date);
			// 同日: 入金を先に
			if (a.kind !== b.kind) return a.kind === "deposit" ? -1 : 1;
			return 0;
		});
		return list;
	}, [deposits, receipts]);
}

function SummaryCard({ label, value }: { label: string; value: string }) {
	return (
		<Card>
			<CardContent className="pt-4 pb-3 text-center">
				<p className="text-xs text-muted-foreground">{label}</p>
				<p className="text-lg font-bold">{value}</p>
			</CardContent>
		</Card>
	);
}
