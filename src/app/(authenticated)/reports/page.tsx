"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	type Client,
	type Project,
	type Receipt,
	getClients,
	getProjects,
	getReceipts,
} from "@/libs/storage";
import { formatCurrency } from "@/utils/formatCurrency";

function getYearMonth(date: string): string {
	return date.slice(0, 7);
}

function formatYearMonth(ym: string): string {
	const [y, m] = ym.split("-");
	return `${y}年${Number(m)}月`;
}

type SummaryRow = { label: string; amount: number; count: number };

function BarSection({
	title,
	rows,
	maxAmount,
}: { title: string; rows: SummaryRow[]; maxAmount: number }) {
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

	const projectMap = useMemo(() => {
		const m = new Map<string, string>();
		for (const p of projects) m.set(p.id, p.name);
		return m;
	}, [projects]);

	const clientMap = useMemo(() => {
		const m = new Map<string, string>();
		for (const c of clients) m.set(c.id, c.name);
		return m;
	}, [clients]);

	const years = useMemo(() => {
		const set = new Set<string>();
		for (const r of receipts) {
			if (r.date) set.add(r.date.slice(0, 4));
		}
		return Array.from(set).sort().reverse();
	}, [receipts]);

	const filtered = useMemo(() => {
		if (!filterYear) return receipts;
		return receipts.filter((r) => r.date?.startsWith(filterYear));
	}, [receipts, filterYear]);

	const totalAmount = useMemo(() => {
		let sum = 0;
		for (const r of filtered) sum += r.amount ?? 0;
		return sum;
	}, [filtered]);

	const totalTax = useMemo(() => {
		let sum = 0;
		for (const r of filtered) sum += r.taxAmount ?? 0;
		return sum;
	}, [filtered]);

	const monthlyRows = useMemo(() => {
		const map = new Map<string, { amount: number; count: number }>();
		for (const r of filtered) {
			if (!r.date) continue;
			const ym = getYearMonth(r.date);
			const cur = map.get(ym) ?? { amount: 0, count: 0 };
			cur.amount += r.amount ?? 0;
			cur.count++;
			map.set(ym, cur);
		}
		return Array.from(map.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([ym, v]) => ({ label: formatYearMonth(ym), ...v }));
	}, [filtered]);

	const projectRows = useMemo(() => {
		const map = new Map<string, { amount: number; count: number }>();
		for (const r of filtered) {
			const key = r.projectId
				? projectMap.get(r.projectId) ?? "不明"
				: "未設定";
			const cur = map.get(key) ?? { amount: 0, count: 0 };
			cur.amount += r.amount ?? 0;
			cur.count++;
			map.set(key, cur);
		}
		return Array.from(map.entries())
			.sort(([, a], [, b]) => b.amount - a.amount)
			.map(([label, v]) => ({ label, ...v }));
	}, [filtered, projectMap]);

	const clientRows = useMemo(() => {
		const map = new Map<string, { amount: number; count: number }>();
		for (const r of filtered) {
			const key = r.clientId ? clientMap.get(r.clientId) ?? "不明" : "未設定";
			const cur = map.get(key) ?? { amount: 0, count: 0 };
			cur.amount += r.amount ?? 0;
			cur.count++;
			map.set(key, cur);
		}
		return Array.from(map.entries())
			.sort(([, a], [, b]) => b.amount - a.amount)
			.map(([label, v]) => ({ label, ...v }));
	}, [filtered, clientMap]);

	const categoryRows = useMemo(() => {
		const map = new Map<string, { amount: number; count: number }>();
		for (const r of filtered) {
			const key = r.accountCategory ?? "未設定";
			const cur = map.get(key) ?? { amount: 0, count: 0 };
			cur.amount += r.amount ?? 0;
			cur.count++;
			map.set(key, cur);
		}
		return Array.from(map.entries())
			.sort(([, a], [, b]) => b.amount - a.amount)
			.map(([label, v]) => ({ label, ...v }));
	}, [filtered]);

	const globalMax = useMemo(() => {
		let max = 0;
		for (const rows of [monthlyRows, projectRows, clientRows, categoryRows]) {
			for (const r of rows) {
				if (r.amount > max) max = r.amount;
			}
		}
		return max;
	}, [monthlyRows, projectRows, clientRows, categoryRows]);

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
				<Card>
					<CardContent className="pt-4 pb-3 text-center">
						<p className="text-xs text-muted-foreground">件数</p>
						<p className="text-xl font-bold">{filtered.length}件</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4 pb-3 text-center">
						<p className="text-xs text-muted-foreground">合計金額</p>
						<p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4 pb-3 text-center">
						<p className="text-xs text-muted-foreground">税額合計</p>
						<p className="text-xl font-bold">{formatCurrency(totalTax)}</p>
					</CardContent>
				</Card>
			</div>

			{/* 各セクション */}
			<div className="mt-6 space-y-6">
				<BarSection
					title="月別推移"
					rows={monthlyRows}
					maxAmount={globalMax}
				/>
				<BarSection
					title="プロジェクト別"
					rows={projectRows}
					maxAmount={globalMax}
				/>
				<BarSection
					title="顧客別"
					rows={clientRows}
					maxAmount={globalMax}
				/>
				<BarSection
					title="勘定科目別"
					rows={categoryRows}
					maxAmount={globalMax}
				/>
			</div>
		</div>
	);
}
