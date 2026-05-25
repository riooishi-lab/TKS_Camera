"use client";

import { AlertCircle, Clock, FileWarning, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { PAGE_PATH } from "@/constants/pagePath";
import { useAuth } from "@/contexts/AuthContext";
import {
	type CashReplenishmentRequest,
	getReceipts,
	getReplenishmentRequests,
	getStores,
	type Receipt,
	type Store,
} from "@/libs/storage";
import { formatCurrency } from "@/utils/formatCurrency";

function getYearMonth(date: string): string {
	return date.slice(0, 7);
}

function formatYearMonth(ym: string): string {
	const [y, m] = ym.split("-");
	return `${y}年${Number(m)}月`;
}

// 遅延申請: 伝票日付の月と申請登録日(submittedAt)の月が異なる場合
function isLateSubmission(r: Receipt): boolean {
	if (!r.date || !r.submittedAt) return false;
	const d = r.date.slice(0, 7);
	const s = r.submittedAt.slice(0, 7);
	return d !== s;
}

// 翌月月初日 (YYYY-MM-01) を返す
function nextMonthFirstDay(): string {
	const d = new Date();
	d.setMonth(d.getMonth() + 1);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function SummaryCard({
	label,
	value,
	icon,
	highlight,
}: {
	label: string;
	value: string;
	icon: React.ReactNode;
	highlight?: boolean;
}) {
	return (
		<Card>
			<CardContent className="flex items-center gap-3 pt-4 pb-3">
				<div
					className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
						highlight
							? "bg-primary/10 text-primary"
							: "bg-muted text-muted-foreground"
					}`}
				>
					{icon}
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-xs text-muted-foreground">{label}</p>
					<p
						className={`truncate text-lg font-bold ${
							highlight ? "text-primary" : ""
						}`}
					>
						{value}
					</p>
				</div>
			</CardContent>
		</Card>
	);
}

// 月次×店舗のピボット
type PivotCell = {
	total: number;
	count: number;
	approvedCount: number;
};

function buildPivot(
	receipts: Receipt[],
	stores: Store[],
): {
	months: string[];
	rows: Map<string, Map<string, PivotCell>>; // storeId -> month -> cell
} {
	const monthSet = new Set<string>();
	const rows = new Map<string, Map<string, PivotCell>>();
	// 全店舗を行として確保（データ0でも表示するために）
	for (const s of stores) rows.set(s.id, new Map());

	for (const r of receipts) {
		if (!r.date) continue;
		const ym = getYearMonth(r.date);
		monthSet.add(ym);
		const storeKey = r.storeId ?? "";
		if (!rows.has(storeKey)) rows.set(storeKey, new Map());
		const monthMap = rows.get(storeKey);
		if (!monthMap) continue;
		const cur = monthMap.get(ym) ?? { total: 0, count: 0, approvedCount: 0 };
		cur.total += r.amount ?? 0;
		cur.count += 1;
		// accountant_approved 以降を「承認済み」として進捗集計
		if (r.status === "accountant_approved" || r.status === "paid") {
			cur.approvedCount += 1;
		}
		monthMap.set(ym, cur);
	}
	const months = Array.from(monthSet).sort();
	return { months, rows };
}

type SummaryRow = { label: string; amount: number; count: number };

function aggregateByKey(
	receipts: Receipt[],
	keyFn: (r: Receipt) => string | null,
): SummaryRow[] {
	const map = new Map<string, { amount: number; count: number }>();
	for (const r of receipts) {
		const key = keyFn(r) ?? "未設定";
		const cur = map.get(key) ?? { amount: 0, count: 0 };
		cur.amount += r.amount ?? 0;
		cur.count++;
		map.set(key, cur);
	}
	return Array.from(map.entries())
		.sort(([, a], [, b]) => b.amount - a.amount)
		.map(([label, v]) => ({ label, ...v }));
}

function BarSection({
	title,
	rows,
	maxAmount,
}: {
	title: string;
	rows: SummaryRow[];
	maxAmount: number;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">{title}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{rows.length === 0 && (
					<p className="text-sm text-muted-foreground">データなし</p>
				)}
				{rows.map((row) => {
					const pct = maxAmount > 0 ? (row.amount / maxAmount) * 100 : 0;
					return (
						<div key={row.label}>
							<div className="flex items-center justify-between text-sm">
								<span className="truncate font-medium">{row.label}</span>
								<span className="ml-2 shrink-0 tabular-nums">
									{formatCurrency(row.amount)}
									<span className="ml-1 text-xs text-muted-foreground">
										({row.count}件)
									</span>
								</span>
							</div>
							<div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
								<div
									className="h-full rounded-full bg-primary transition-all"
									style={{ width: `${Math.max(pct, 1)}%` }}
								/>
							</div>
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}

export default function ReportsPage() {
	const { tksUser } = useAuth();
	const [receipts, setReceipts] = useState<Receipt[]>([]);
	const [stores, setStores] = useState<Store[]>([]);
	const [replenishments, setReplenishments] = useState<
		CashReplenishmentRequest[]
	>([]);
	const [filterYear, setFilterYear] = useState("");

	const role = tksUser?.role;
	const isStoreManager = role === "store_manager";

	useEffect(() => {
		Promise.all([getReceipts(), getStores(), getReplenishmentRequests()]).then(
			([r, s, rp]) => {
				setReceipts(r);
				setStores(s);
				setReplenishments(rp);
			},
		);
	}, []);

	// store_manager は自店舗のみに絞る (REQ-RPT-03)
	const scopedReceipts = useMemo(() => {
		if (isStoreManager && tksUser?.storeId) {
			return receipts.filter((r) => r.storeId === tksUser.storeId);
		}
		return receipts;
	}, [receipts, isStoreManager, tksUser?.storeId]);

	const scopedStores = useMemo(() => {
		if (isStoreManager && tksUser?.storeId) {
			return stores.filter((s) => s.id === tksUser.storeId);
		}
		return stores;
	}, [stores, isStoreManager, tksUser?.storeId]);

	const scopedReplenishments = useMemo(() => {
		if (isStoreManager && tksUser?.storeId) {
			return replenishments.filter((r) => r.storeId === tksUser.storeId);
		}
		return replenishments;
	}, [replenishments, isStoreManager, tksUser?.storeId]);

	const years = useMemo(() => {
		const set = new Set(
			scopedReceipts
				.filter((r): r is Receipt & { date: string } => r.date !== null)
				.map((r) => r.date.slice(0, 4)),
		);
		return Array.from(set).sort().reverse();
	}, [scopedReceipts]);

	const filteredReceipts = useMemo(() => {
		if (!filterYear) return scopedReceipts;
		return scopedReceipts.filter((r) => r.date?.startsWith(filterYear));
	}, [scopedReceipts, filterYear]);

	// ダッシュボードバッジ用集計 (REQ-RPT-04)
	const unapprovedCount = filteredReceipts.filter(
		(r) => r.status === "pending" || r.status === "manager_approved",
	).length;
	const rejectedCount = filteredReceipts.filter(
		(r) => r.status === "rejected",
	).length;
	const lateCount = filteredReceipts.filter(isLateSubmission).length;
	const nextMonth = nextMonthFirstDay();
	const nextMonthReplenishment = scopedReplenishments
		.filter(
			(r) =>
				r.targetMonth === nextMonth &&
				(r.status === "pending" || r.status === "approved"),
		)
		.reduce((sum, r) => sum + r.requestedAmount, 0);

	// expense_type 内訳 (REQ-RPT-05)
	const pettyTotal = filteredReceipts
		.filter((r) => r.expenseType === "petty_cash")
		.reduce((sum, r) => sum + (r.amount ?? 0), 0);
	const personalTotal = filteredReceipts
		.filter((r) => r.expenseType === "personal")
		.reduce((sum, r) => sum + (r.amount ?? 0), 0);

	const totalAmount = filteredReceipts.reduce(
		(sum, r) => sum + (r.amount ?? 0),
		0,
	);
	const totalTax = filteredReceipts.reduce(
		(sum, r) => sum + (r.taxAmount ?? 0),
		0,
	);

	const pivot = useMemo(
		() => buildPivot(filteredReceipts, scopedStores),
		[filteredReceipts, scopedStores],
	);

	const storeRows = useMemo(() => {
		const storeNameMap = new Map(scopedStores.map((s) => [s.id, s.name]));
		return aggregateByKey(filteredReceipts, (r) =>
			r.storeId ? (storeNameMap.get(r.storeId) ?? "不明") : null,
		);
	}, [filteredReceipts, scopedStores]);

	const categoryRows = useMemo(
		() => aggregateByKey(filteredReceipts, (r) => r.accountCategory ?? null),
		[filteredReceipts],
	);

	const sectionMax = useMemo(
		() =>
			Math.max(
				0,
				...[storeRows, categoryRows].flatMap((rows) =>
					rows.map((r) => r.amount),
				),
			),
		[storeRows, categoryRows],
	);

	if (role === "store_staff") {
		return (
			<div className="py-12 text-center text-muted-foreground">
				このページにはアクセスできません
			</div>
		);
	}

	return (
		<div>
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">レポート</h1>
				<select
					value={filterYear}
					onChange={(e) => setFilterYear(e.target.value)}
					className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
				>
					<option value="">全期間</option>
					{years.map((y) => (
						<option key={y} value={y}>
							{y}年
						</option>
					))}
				</select>
			</div>

			{/* ダッシュボード: 主要KPI (REQ-RPT-04) */}
			<div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
				<SummaryCard
					label="未承認"
					value={`${unapprovedCount}件`}
					icon={<AlertCircle className="h-4 w-4" />}
					highlight={unapprovedCount > 0}
				/>
				<SummaryCard
					label="差戻し"
					value={`${rejectedCount}件`}
					icon={<FileWarning className="h-4 w-4" />}
					highlight={rejectedCount > 0}
				/>
				<SummaryCard
					label="遅延申請"
					value={`${lateCount}件`}
					icon={<Clock className="h-4 w-4" />}
				/>
				<SummaryCard
					label="翌月補充希望額"
					value={formatCurrency(nextMonthReplenishment)}
					icon={<Wallet className="h-4 w-4" />}
				/>
			</div>

			{/* 概要 */}
			<div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
				<SummaryCard
					label="件数"
					value={`${filteredReceipts.length}件`}
					icon={<span className="text-base">#</span>}
				/>
				<SummaryCard
					label="合計金額"
					value={formatCurrency(totalAmount)}
					icon={<span className="text-base">¥</span>}
				/>
				<SummaryCard
					label="小口現金"
					value={formatCurrency(pettyTotal)}
					icon={<span className="text-xs">小</span>}
				/>
				<SummaryCard
					label="店長立替"
					value={formatCurrency(personalTotal)}
					icon={<span className="text-xs">立</span>}
				/>
			</div>

			{/* 月次×店舗ピボット (REQ-RPT-01, REQ-RPT-02) */}
			<Card className="mt-6">
				<CardHeader>
					<CardTitle className="text-base">月次 × 店舗</CardTitle>
				</CardHeader>
				<CardContent>
					{pivot.months.length === 0 ? (
						<p className="text-sm text-muted-foreground">データがありません</p>
					) : (
						<div className="overflow-x-auto rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="sticky left-0 bg-background">
											店舗
										</TableHead>
										{pivot.months.map((m) => (
											<TableHead key={m} className="text-right">
												{formatYearMonth(m)}
											</TableHead>
										))}
									</TableRow>
								</TableHeader>
								<TableBody>
									{scopedStores.map((s) => {
										const monthMap = pivot.rows.get(s.id);
										return (
											<TableRow key={s.id}>
												<TableCell className="sticky left-0 bg-background font-medium">
													{s.name}
												</TableCell>
												{pivot.months.map((m) => {
													const cell = monthMap?.get(m);
													if (!cell || cell.count === 0) {
														return (
															<TableCell
																key={m}
																className="text-right text-muted-foreground"
															>
																-
															</TableCell>
														);
													}
													const href = `${PAGE_PATH.receipts}?month=${m}&storeId=${s.id}`;
													const fullyApproved =
														cell.approvedCount === cell.count;
													return (
														<TableCell key={m} className="text-right">
															<Link
																href={href}
																className="block hover:bg-muted/30"
															>
																<div className="text-sm font-medium tabular-nums">
																	{formatCurrency(cell.total)}
																</div>
																<div className="text-[10px] text-muted-foreground">
																	承認 {cell.approvedCount}/{cell.count}
																	{fullyApproved && (
																		<Badge
																			variant="outline"
																			className="ml-1 border-green-500 px-1 py-0 text-[9px] text-green-700"
																		>
																			済
																		</Badge>
																	)}
																</div>
															</Link>
														</TableCell>
													);
												})}
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>

			{/* 内訳 */}
			<div className="mt-6 grid gap-6 md:grid-cols-2">
				<BarSection title="店舗別" rows={storeRows} maxAmount={sectionMax} />
				<BarSection
					title="勘定科目別"
					rows={categoryRows}
					maxAmount={sectionMax}
				/>
			</div>

			<p className="mt-6 text-xs text-muted-foreground">
				税額合計: {formatCurrency(totalTax)}
			</p>
		</div>
	);
}
