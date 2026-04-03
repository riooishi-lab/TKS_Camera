"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
	type Client,
	getClients,
	getProjects,
	getReceipts,
	type Project,
	type Receipt,
} from "@/libs/storage";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

function ReceiptRow({
	receipt,
	projectMap,
	clientMap,
}: {
	receipt: Receipt;
	projectMap: Map<string, string>;
	clientMap: Map<string, string>;
}) {
	return (
		<TableRow>
			<TableCell>
				<Link
					href={PAGE_PATH.receiptDetail(receipt.id)}
					className="hover:underline"
				>
					{receipt.date ? formatDate(receipt.date) : "未設定"}
				</Link>
			</TableCell>
			<TableCell>
				<Link
					href={PAGE_PATH.receiptDetail(receipt.id)}
					className="hover:underline"
				>
					{receipt.payee ?? "未設定"}
				</Link>
			</TableCell>
			<TableCell className="text-right">
				{receipt.amount != null ? formatCurrency(receipt.amount) : "-"}
			</TableCell>
			<TableCell className="hidden sm:table-cell">
				{receipt.accountCategory ?? "-"}
			</TableCell>
			<TableCell className="hidden sm:table-cell">
				{receipt.projectId ? (projectMap.get(receipt.projectId) ?? "-") : "-"}
			</TableCell>
			<TableCell className="hidden sm:table-cell">
				{receipt.clientId ? (clientMap.get(receipt.clientId) ?? "-") : "-"}
			</TableCell>
			<TableCell>
				{receipt.isAiVerified ? (
					<Badge variant="default">確認済</Badge>
				) : (
					<Badge variant="secondary">未確認</Badge>
				)}
			</TableCell>
		</TableRow>
	);
}

const FILTER_SELECT_CLASS =
	"h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring";

function FilterSelect({
	value,
	onChange,
	placeholder,
	options,
}: {
	value: string;
	onChange: (v: string) => void;
	placeholder: string;
	options: { value: string; label: string }[];
}) {
	return (
		<select
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className={FILTER_SELECT_CLASS}
		>
			<option value="">{placeholder}</option>
			{options.map((o) => (
				<option key={o.value} value={o.value}>
					{o.label}
				</option>
			))}
		</select>
	);
}

function getYearMonth(date: string): string {
	return date.slice(0, 7); // "YYYY-MM"
}

function formatYearMonth(ym: string): string {
	const [y, m] = ym.split("-");
	return `${y}年${Number(m)}月`;
}

export default function ReceiptsPage() {
	const { tksUser } = useAuth();
	const canCreate = tksUser?.role === "admin" || tksUser?.role === "editor";
	const [receipts, setReceipts] = useState<Receipt[]>([]);
	const [projects, setProjects] = useState<Project[]>([]);
	const [clients, setClients] = useState<Client[]>([]);

	const [filterMonth, setFilterMonth] = useState("");
	const [filterProject, setFilterProject] = useState("");
	const [filterClient, setFilterClient] = useState("");

	useEffect(() => {
		getReceipts().then(setReceipts);
		getProjects().then(setProjects);
		getClients().then(setClients);
	}, []);

	const months = useMemo(() => {
		const set = new Set(
			receipts.filter((r) => r.date).map((r) => getYearMonth(r.date!)),
		);
		return Array.from(set).sort().reverse();
	}, [receipts]);

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

	const filtered = useMemo(() => {
		return receipts.filter((r) => {
			if (filterMonth && (!r.date || getYearMonth(r.date) !== filterMonth))
				return false;
			if (filterProject && r.projectId !== filterProject) return false;
			if (filterClient && r.clientId !== filterClient) return false;
			return true;
		});
	}, [receipts, filterMonth, filterProject, filterClient]);

	const summary = useMemo(
		() => ({
			count: filtered.length,
			total: filtered.reduce((sum, r) => sum + (r.amount ?? 0), 0),
			taxTotal: filtered.reduce((sum, r) => sum + (r.taxAmount ?? 0), 0),
		}),
		[filtered],
	);

	const hasFilter = filterMonth || filterProject || filterClient;

	return (
		<div>
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">レシート一覧</h1>
				{canCreate && (
					<Button render={<Link href={PAGE_PATH.receiptNew} />}>
						<Plus className="mr-2 h-4 w-4" />
						レシート登録
					</Button>
				)}
			</div>

			{/* フィルター */}
			<div className="mt-4 flex flex-wrap items-center gap-2">
				<FilterSelect
					value={filterMonth}
					onChange={setFilterMonth}
					placeholder="全期間"
					options={months.map((ym) => ({
						value: ym,
						label: formatYearMonth(ym),
					}))}
				/>
				<FilterSelect
					value={filterClient}
					onChange={setFilterClient}
					placeholder="全顧客"
					options={clients.map((c) => ({ value: c.id, label: c.name }))}
				/>
				<FilterSelect
					value={filterProject}
					onChange={setFilterProject}
					placeholder="全PJ"
					options={projects.map((p) => ({ value: p.id, label: p.name }))}
				/>
				{hasFilter && (
					<button
						type="button"
						onClick={() => {
							setFilterMonth("");
							setFilterProject("");
							setFilterClient("");
						}}
						className="text-xs text-muted-foreground hover:text-foreground"
					>
						クリア
					</button>
				)}
			</div>

			{/* 集計バー */}
			<div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border bg-muted/50 px-4 py-2.5 text-sm">
				<span>
					<span className="text-muted-foreground">件数:</span>{" "}
					<span className="font-semibold">{summary.count}件</span>
				</span>
				<span>
					<span className="text-muted-foreground">合計:</span>{" "}
					<span className="font-semibold">{formatCurrency(summary.total)}</span>
				</span>
				<span>
					<span className="text-muted-foreground">税額:</span>{" "}
					<span className="font-semibold">
						{formatCurrency(summary.taxTotal)}
					</span>
				</span>
			</div>

			{filtered.length > 0 ? (
				<div className="mt-4 rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>日付</TableHead>
								<TableHead>支払先</TableHead>
								<TableHead className="text-right">金額</TableHead>
								<TableHead className="hidden sm:table-cell">勘定科目</TableHead>
								<TableHead className="hidden sm:table-cell">PJ</TableHead>
								<TableHead className="hidden sm:table-cell">顧客</TableHead>
								<TableHead>状態</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filtered.map((receipt) => (
								<ReceiptRow
									key={receipt.id}
									receipt={receipt}
									projectMap={projectMap}
									clientMap={clientMap}
								/>
							))}
						</TableBody>
					</Table>
				</div>
			) : (
				<div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
					<p className="text-muted-foreground">
						{hasFilter
							? "該当するレシートがありません"
							: "レシートがまだ登録されていません"}
					</p>
					{!hasFilter && canCreate && (
						<Button
							render={<Link href={PAGE_PATH.receiptNew} />}
							variant="outline"
							className="mt-4"
						>
							最初のレシートを登録する
						</Button>
					)}
				</div>
			)}
		</div>
	);
}
