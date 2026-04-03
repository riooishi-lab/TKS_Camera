"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	type Client,
	getClients,
	getProjects,
	getReceipts,
	type Project,
	type Receipt,
} from "@/libs/storage";
import { formatCurrency } from "@/utils/formatCurrency";

function getYearMonth(date: string): string {
	return date.slice(0, 7);
}

function formatYearMonth(ym: string): string {
	const [y, m] = ym.split("-");
	return `${y}年${Number(m)}月`;
}

function createIdNameMap<T extends { id: string; name: string }>(
	items: T[],
): Map<string, string> {
	const m = new Map<string, string>();
	for (const item of items) m.set(item.id, item.name);
	return m;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
	return (
		<Card>
			<CardContent className="pt-4 pb-3 text-center">
				<p className="text-xs text-muted-foreground">{label}</p>
				<p className="text-xl font-bold">{value}</p>
			</CardContent>
		</Card>
	);
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
	const [receipts, setReceipts] = useState<Receipt[]>([]);
	const [projects, setProjects] = useState<Project[]>([]);
	const [clients, setClients] = useState<Client[]>([]);
	const [filterYear, setFilterYear] = useState("");

	useEffect(() => {
		Promise.all([getReceipts(), getProjects(), getClients()]).then(
			([r, p, c]) => {
				setReceipts(r);
				setProjects(p);
				setClients(c);
			},
		);
	}, []);

	const projectMap = useMemo(() => createIdNameMap(projects), [projects]);
	const clientMap = useMemo(() => createIdNameMap(clients), [clients]);

	const years = useMemo(() => {
		const set = new Set(
			receipts.filter((r) => r.date).map((r) => r.date!.slice(0, 4)),
		);
		return Array.from(set).sort().reverse();
	}, [receipts]);

	const filtered = useMemo(() => {
		if (!filterYear) return receipts;
		return receipts.filter((r) => r.date?.startsWith(filterYear));
	}, [receipts, filterYear]);

	const totalAmount = useMemo(
		() => filtered.reduce((sum, r) => sum + (r.amount ?? 0), 0),
		[filtered],
	);

	const totalTax = useMemo(
		() => filtered.reduce((sum, r) => sum + (r.taxAmount ?? 0), 0),
		[filtered],
	);

	const monthlyRows = useMemo(() => {
		const rows = aggregateByKey(filtered, (r) =>
			r.date ? formatYearMonth(getYearMonth(r.date)) : null,
		);
		return rows.sort((a, b) => a.label.localeCompare(b.label));
	}, [filtered]);

	const projectRows = useMemo(
		() =>
			aggregateByKey(filtered, (r) =>
				r.projectId ? (projectMap.get(r.projectId) ?? "不明") : null,
			),
		[filtered, projectMap],
	);

	const clientRows = useMemo(
		() =>
			aggregateByKey(filtered, (r) =>
				r.clientId ? (clientMap.get(r.clientId) ?? "不明") : null,
			),
		[filtered, clientMap],
	);

	const categoryRows = useMemo(
		() => aggregateByKey(filtered, (r) => r.accountCategory ?? null),
		[filtered],
	);

	const globalMax = useMemo(
		() =>
			Math.max(
				0,
				...[monthlyRows, projectRows, clientRows, categoryRows].flatMap(
					(rows) => rows.map((r) => r.amount),
				),
			),
		[monthlyRows, projectRows, clientRows, categoryRows],
	);

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

			{/* サマリー */}
			<div className="mt-4 grid grid-cols-3 gap-3">
				<SummaryCard label="件数" value={`${filtered.length}件`} />
				<SummaryCard label="合計金額" value={formatCurrency(totalAmount)} />
				<SummaryCard label="税額合計" value={formatCurrency(totalTax)} />
			</div>

			{/* 各セクション */}
			<div className="mt-6 space-y-6">
				<BarSection title="月別推移" rows={monthlyRows} maxAmount={globalMax} />
				<BarSection
					title="プロジェクト別"
					rows={projectRows}
					maxAmount={globalMax}
				/>
				<BarSection title="顧客別" rows={clientRows} maxAmount={globalMax} />
				<BarSection
					title="勘定科目別"
					rows={categoryRows}
					maxAmount={globalMax}
				/>
			</div>
		</div>
	);
}
