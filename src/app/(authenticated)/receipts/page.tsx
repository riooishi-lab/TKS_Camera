"use client";

import { Plus, Settings2 } from "lucide-react";
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
	getStaff,
	type Project,
	type Receipt,
	type Staff,
} from "@/libs/storage";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

type ColumnKey =
	| "date"
	| "payee"
	| "amount"
	| "accountCategory"
	| "project"
	| "client"
	| "personInCharge"
	| "description"
	| "taxAmount"
	| "status";

type ColumnDef = {
	key: ColumnKey;
	label: string;
	defaultVisible: boolean;
	alwaysVisible?: boolean;
	align?: "right";
};

const ALL_COLUMNS: ColumnDef[] = [
	{ key: "date", label: "日付", defaultVisible: true, alwaysVisible: true },
	{ key: "payee", label: "支払先", defaultVisible: true, alwaysVisible: true },
	{ key: "amount", label: "金額", defaultVisible: true, align: "right" },
	{ key: "accountCategory", label: "勘定科目", defaultVisible: true },
	{ key: "project", label: "PJ", defaultVisible: true },
	{ key: "client", label: "顧客", defaultVisible: true },
	{ key: "personInCharge", label: "担当者", defaultVisible: false },
	{ key: "description", label: "摘要", defaultVisible: false },
	{ key: "taxAmount", label: "税額", defaultVisible: false, align: "right" },
	{ key: "status", label: "状態", defaultVisible: true },
];

const STORAGE_KEY = "receipt-list-columns";

function loadVisibleColumns(): Set<ColumnKey> {
	if (typeof window === "undefined") {
		return new Set(
			ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key),
		);
	}
	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved) {
		try {
			return new Set(JSON.parse(saved) as ColumnKey[]);
		} catch {
			// ignore
		}
	}
	return new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key));
}

function CellValue({
	col,
	receipt,
	projectMap,
	clientMap,
}: {
	col: ColumnKey;
	receipt: Receipt;
	projectMap: Map<string, string>;
	clientMap: Map<string, string>;
}) {
	switch (col) {
		case "date":
			return (
				<Link
					href={PAGE_PATH.receiptDetail(receipt.id)}
					className="hover:underline"
				>
					{receipt.date ? formatDate(receipt.date) : "未設定"}
				</Link>
			);
		case "payee":
			return (
				<Link
					href={PAGE_PATH.receiptDetail(receipt.id)}
					className="hover:underline"
				>
					{receipt.payee ?? "未設定"}
				</Link>
			);
		case "amount":
			return receipt.amount != null ? formatCurrency(receipt.amount) : "-";
		case "taxAmount":
			return receipt.taxAmount != null
				? formatCurrency(receipt.taxAmount)
				: "-";
		case "accountCategory":
			return receipt.accountCategory ?? "-";
		case "project":
			return receipt.projectId
				? (projectMap.get(receipt.projectId) ?? "-")
				: "-";
		case "client":
			return receipt.clientId ? (clientMap.get(receipt.clientId) ?? "-") : "-";
		case "personInCharge":
			return receipt.personInCharge ?? "-";
		case "description":
			return receipt.description ?? "-";
		case "status":
			return receipt.isAiVerified ? (
				<Badge variant="default">確認済</Badge>
			) : (
				<Badge variant="secondary">未確認</Badge>
			);
	}
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

function ColumnSettings({
	visibleCols,
	onToggle,
}: {
	visibleCols: Set<ColumnKey>;
	onToggle: (key: ColumnKey) => void;
}) {
	return (
		<div className="mt-3 flex flex-wrap gap-2 rounded-lg border bg-muted/30 p-3">
			<span className="mr-1 text-xs font-medium text-muted-foreground">
				表示項目:
			</span>
			{ALL_COLUMNS.map((col) => (
				<button
					key={col.key}
					type="button"
					disabled={col.alwaysVisible}
					onClick={() => onToggle(col.key)}
					className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
						col.alwaysVisible || visibleCols.has(col.key)
							? "border-primary bg-primary/10 text-primary"
							: "border-border text-muted-foreground hover:border-primary/50"
					} ${col.alwaysVisible ? "opacity-60 cursor-default" : "cursor-pointer"}`}
				>
					{col.label}
				</button>
			))}
		</div>
	);
}

function FilterBar({
	filterMonth,
	setFilterMonth,
	filterClient,
	setFilterClient,
	filterProject,
	setFilterProject,
	months,
	clients,
	projects,
}: {
	filterMonth: string;
	setFilterMonth: (v: string) => void;
	filterClient: string;
	setFilterClient: (v: string) => void;
	filterProject: string;
	setFilterProject: (v: string) => void;
	months: string[];
	clients: Client[];
	projects: Project[];
}) {
	const hasFilter = filterMonth || filterClient || filterProject;
	return (
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
	);
}

function ReceiptTable({
	receipts,
	columns,
	projectMap,
	clientMap,
}: {
	receipts: Receipt[];
	columns: ColumnDef[];
	projectMap: Map<string, string>;
	clientMap: Map<string, string>;
}) {
	return (
		<div className="mt-4 overflow-x-auto rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						{columns.map((col) => (
							<TableHead
								key={col.key}
								className={`${col.align === "right" ? "text-right" : ""} ${
									!col.alwaysVisible ? "hidden sm:table-cell" : ""
								}`}
							>
								{col.label}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{receipts.map((receipt) => (
						<TableRow key={receipt.id}>
							{columns.map((col) => (
								<TableCell
									key={col.key}
									className={`${col.align === "right" ? "text-right" : ""} ${
										!col.alwaysVisible ? "hidden sm:table-cell" : ""
									}`}
								>
									<CellValue
										col={col.key}
										receipt={receipt}
										projectMap={projectMap}
										clientMap={clientMap}
									/>
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

function SummaryBar({
	count,
	total,
	taxTotal,
}: {
	count: number;
	total: number;
	taxTotal: number;
}) {
	return (
		<div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border bg-muted/50 px-4 py-2.5 text-sm">
			<span>
				<span className="text-muted-foreground">件数:</span>{" "}
				<span className="font-semibold">{count}件</span>
			</span>
			<span>
				<span className="text-muted-foreground">合計:</span>{" "}
				<span className="font-semibold">{formatCurrency(total)}</span>
			</span>
			<span>
				<span className="text-muted-foreground">税額:</span>{" "}
				<span className="font-semibold">{formatCurrency(taxTotal)}</span>
			</span>
		</div>
	);
}

function getYearMonth(date: string): string {
	return date.slice(0, 7);
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
	const [_staffList, setStaffList] = useState<Staff[]>([]);

	const [filterMonth, setFilterMonth] = useState("");
	const [filterProject, setFilterProject] = useState("");
	const [filterClient, setFilterClient] = useState("");

	const [visibleCols, setVisibleCols] =
		useState<Set<ColumnKey>>(loadVisibleColumns);
	const [showColSettings, setShowColSettings] = useState(false);

	useEffect(() => {
		getReceipts().then(setReceipts);
		getProjects().then(setProjects);
		getClients().then(setClients);
		getStaff().then(setStaffList);
	}, []);

	const toggleColumn = (key: ColumnKey) => {
		setVisibleCols((prev) => {
			const next = new Set(prev);
			next.has(key) ? next.delete(key) : next.add(key);
			localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
			return next;
		});
	};

	const activeColumns = ALL_COLUMNS.filter(
		(c) => c.alwaysVisible || visibleCols.has(c.key),
	);

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

	const hasFilter = Boolean(filterMonth || filterProject || filterClient);

	return (
		<div>
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">レシート一覧</h1>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setShowColSettings((v) => !v)}
						title="表示カラム設定"
					>
						<Settings2 className="h-4 w-4" />
					</Button>
					{canCreate && (
						<Button render={<Link href={PAGE_PATH.receiptNew} />}>
							<Plus className="mr-2 h-4 w-4" />
							レシート登録
						</Button>
					)}
				</div>
			</div>

			{showColSettings && (
				<ColumnSettings visibleCols={visibleCols} onToggle={toggleColumn} />
			)}

			<FilterBar
				filterMonth={filterMonth}
				setFilterMonth={setFilterMonth}
				filterClient={filterClient}
				setFilterClient={setFilterClient}
				filterProject={filterProject}
				setFilterProject={setFilterProject}
				months={months}
				clients={clients}
				projects={projects}
			/>

			<SummaryBar
				count={summary.count}
				total={summary.total}
				taxTotal={summary.taxTotal}
			/>

			{filtered.length > 0 ? (
				<ReceiptTable
					receipts={filtered}
					columns={activeColumns}
					projectMap={projectMap}
					clientMap={clientMap}
				/>
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
