"use client";

import { Download, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
	getReceiptTags,
	getStaff,
	getTags,
	type Project,
	type Receipt,
	type Staff,
	type Tag,
} from "@/libs/storage";
import { downloadCsv, toCsv } from "@/utils/csv";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { TagBadges } from "./components/TagPicker";

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
	| "tags"
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
	{ key: "tags", label: "タグ", defaultVisible: false },
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
	tagMap,
	receiptTagMap,
}: {
	col: ColumnKey;
	receipt: Receipt;
	projectMap: Map<string, string>;
	clientMap: Map<string, string>;
	tagMap: Map<string, Tag>;
	receiptTagMap: Map<string, string[]>;
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
		case "tags": {
			const ids = receiptTagMap.get(receipt.id) ?? [];
			const tags = ids.map((id) => tagMap.get(id)).filter((t): t is Tag => !!t);
			return <TagBadges tags={tags} />;
		}
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

type FilterState = {
	month: string;
	clientId: string;
	projectId: string;
	payeeQuery: string;
	amountMin: string;
	amountMax: string;
	tagIds: string[];
};

function FilterBar({
	filters,
	setFilters,
	months,
	clients,
	projects,
	tags,
}: {
	filters: FilterState;
	setFilters: (updater: (prev: FilterState) => FilterState) => void;
	months: string[];
	clients: Client[];
	projects: Project[];
	tags: Tag[];
}) {
	const hasFilter =
		filters.month ||
		filters.clientId ||
		filters.projectId ||
		filters.payeeQuery ||
		filters.amountMin ||
		filters.amountMax ||
		filters.tagIds.length > 0;
	const toggleTag = (id: string) => {
		setFilters((prev) => {
			const has = prev.tagIds.includes(id);
			return {
				...prev,
				tagIds: has
					? prev.tagIds.filter((t) => t !== id)
					: [...prev.tagIds, id],
			};
		});
	};
	return (
		<div className="mt-4 space-y-2">
			<div className="flex flex-wrap items-center gap-2">
				<FilterSelect
					value={filters.month}
					onChange={(v) => setFilters((p) => ({ ...p, month: v }))}
					placeholder="全期間"
					options={months.map((ym) => ({
						value: ym,
						label: formatYearMonth(ym),
					}))}
				/>
				<FilterSelect
					value={filters.clientId}
					onChange={(v) => setFilters((p) => ({ ...p, clientId: v }))}
					placeholder="全顧客"
					options={clients.map((c) => ({ value: c.id, label: c.name }))}
				/>
				<FilterSelect
					value={filters.projectId}
					onChange={(v) => setFilters((p) => ({ ...p, projectId: v }))}
					placeholder="全PJ"
					options={projects.map((p) => ({ value: p.id, label: p.name }))}
				/>
				<Input
					placeholder="支払先で検索"
					value={filters.payeeQuery}
					onChange={(e) =>
						setFilters((p) => ({ ...p, payeeQuery: e.target.value }))
					}
					className="h-8 w-44"
				/>
				<Input
					type="number"
					placeholder="最小額"
					value={filters.amountMin}
					onChange={(e) =>
						setFilters((p) => ({ ...p, amountMin: e.target.value }))
					}
					className="h-8 w-24"
				/>
				<span className="text-xs text-muted-foreground">〜</span>
				<Input
					type="number"
					placeholder="最大額"
					value={filters.amountMax}
					onChange={(e) =>
						setFilters((p) => ({ ...p, amountMax: e.target.value }))
					}
					className="h-8 w-24"
				/>
				{hasFilter && (
					<button
						type="button"
						onClick={() =>
							setFilters(() => ({
								month: "",
								clientId: "",
								projectId: "",
								payeeQuery: "",
								amountMin: "",
								amountMax: "",
								tagIds: [],
							}))
						}
						className="text-xs text-muted-foreground hover:text-foreground"
					>
						クリア
					</button>
				)}
			</div>
			{tags.length > 0 && (
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="mr-1 text-xs text-muted-foreground">タグ:</span>
					{tags.map((tag) => {
						const active = filters.tagIds.includes(tag.id);
						return (
							<button
								key={tag.id}
								type="button"
								onClick={() => toggleTag(tag.id)}
								className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
									active
										? "border-primary bg-primary/10 text-primary"
										: "border-border text-muted-foreground hover:border-primary/50"
								}`}
								style={
									active && tag.color
										? { borderColor: tag.color, color: tag.color }
										: undefined
								}
							>
								{tag.name}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}

function ReceiptTable({
	receipts,
	columns,
	projectMap,
	clientMap,
	tagMap,
	receiptTagMap,
}: {
	receipts: Receipt[];
	columns: ColumnDef[];
	projectMap: Map<string, string>;
	clientMap: Map<string, string>;
	tagMap: Map<string, Tag>;
	receiptTagMap: Map<string, string[]>;
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
										tagMap={tagMap}
										receiptTagMap={receiptTagMap}
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

function exportReceiptsToCsv(params: {
	receipts: Receipt[];
	projectMap: Map<string, string>;
	clientMap: Map<string, string>;
	tagMap: Map<string, Tag>;
	receiptTagMap: Map<string, string[]>;
}) {
	const { receipts, projectMap, clientMap, tagMap, receiptTagMap } = params;
	const header = [
		"日付",
		"支払先",
		"金額(税込)",
		"消費税額",
		"税率区分",
		"勘定科目",
		"摘要",
		"インボイス登録番号",
		"プロジェクト",
		"顧客",
		"担当者",
		"タグ",
		"状態",
		"登録日時",
	];
	const body = receipts.map((r) => {
		const tagNames = (receiptTagMap.get(r.id) ?? [])
			.map((id) => tagMap.get(id)?.name)
			.filter(Boolean)
			.join(";");
		return [
			r.date ?? "",
			r.payee ?? "",
			r.amount ?? "",
			r.taxAmount ?? "",
			r.taxRateCategory ?? "",
			r.accountCategory ?? "",
			r.description ?? "",
			r.invoiceRegistrationNo ?? "",
			r.projectId ? (projectMap.get(r.projectId) ?? "") : "",
			r.clientId ? (clientMap.get(r.clientId) ?? "") : "",
			r.personInCharge ?? "",
			tagNames,
			r.isAiVerified ? "確認済" : "未確認",
			r.createdAt,
		];
	});
	const csv = toCsv([header, ...body]);
	const stamp = new Date().toISOString().slice(0, 10);
	downloadCsv(`receipts_${stamp}.csv`, csv);
}

export default function ReceiptsPage() {
	const { tksUser } = useAuth();
	const canCreate = tksUser?.role === "admin" || tksUser?.role === "editor";
	const [receipts, setReceipts] = useState<Receipt[]>([]);
	const [projects, setProjects] = useState<Project[]>([]);
	const [clients, setClients] = useState<Client[]>([]);
	const [_staffList, setStaffList] = useState<Staff[]>([]);
	const [tags, setTags] = useState<Tag[]>([]);
	const [receiptTagMap, setReceiptTagMap] = useState<Map<string, string[]>>(
		new Map(),
	);

	const [filters, setFilters] = useState<FilterState>({
		month: "",
		clientId: "",
		projectId: "",
		payeeQuery: "",
		amountMin: "",
		amountMax: "",
		tagIds: [],
	});

	const [visibleCols, setVisibleCols] =
		useState<Set<ColumnKey>>(loadVisibleColumns);
	const [showColSettings, setShowColSettings] = useState(false);

	useEffect(() => {
		getReceipts().then(setReceipts);
		getProjects().then(setProjects);
		getClients().then(setClients);
		getStaff().then(setStaffList);
		getTags().then(setTags);
		getReceiptTags().then(setReceiptTagMap);
	}, []);

	const toggleColumn = (key: ColumnKey) => {
		setVisibleCols((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
			return next;
		});
	};

	const activeColumns = ALL_COLUMNS.filter(
		(c) => c.alwaysVisible || visibleCols.has(c.key),
	);

	const months = useMemo(() => {
		const set = new Set(
			receipts
				.filter((r): r is Receipt & { date: string } => r.date !== null)
				.map((r) => getYearMonth(r.date)),
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
	const tagMap = useMemo(() => {
		const m = new Map<string, Tag>();
		for (const t of tags) m.set(t.id, t);
		return m;
	}, [tags]);

	const filtered = useMemo(() => {
		const min = filters.amountMin ? Number(filters.amountMin) : null;
		const max = filters.amountMax ? Number(filters.amountMax) : null;
		const q = filters.payeeQuery.trim().toLowerCase();
		return receipts.filter((r) => {
			if (filters.month && (!r.date || getYearMonth(r.date) !== filters.month))
				return false;
			if (filters.projectId && r.projectId !== filters.projectId) return false;
			if (filters.clientId && r.clientId !== filters.clientId) return false;
			if (q && !(r.payee ?? "").toLowerCase().includes(q)) return false;
			if (min != null && (r.amount ?? 0) < min) return false;
			if (max != null && (r.amount ?? 0) > max) return false;
			if (filters.tagIds.length > 0) {
				const rTags = receiptTagMap.get(r.id) ?? [];
				const match = filters.tagIds.every((t) => rTags.includes(t));
				if (!match) return false;
			}
			return true;
		});
	}, [receipts, filters, receiptTagMap]);

	const summary = useMemo(
		() => ({
			count: filtered.length,
			total: filtered.reduce((sum, r) => sum + (r.amount ?? 0), 0),
			taxTotal: filtered.reduce((sum, r) => sum + (r.taxAmount ?? 0), 0),
		}),
		[filtered],
	);

	const hasFilter =
		filters.month ||
		filters.projectId ||
		filters.clientId ||
		filters.payeeQuery ||
		filters.amountMin ||
		filters.amountMax ||
		filters.tagIds.length > 0;

	return (
		<div>
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">レシート一覧</h1>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() =>
							exportReceiptsToCsv({
								receipts: filtered,
								projectMap,
								clientMap,
								tagMap,
								receiptTagMap,
							})
						}
						disabled={filtered.length === 0}
						title="表示中のレシートをCSV出力"
					>
						<Download className="mr-1.5 h-4 w-4" />
						CSV
					</Button>
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
				filters={filters}
				setFilters={setFilters}
				months={months}
				clients={clients}
				projects={projects}
				tags={tags}
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
					tagMap={tagMap}
					receiptTagMap={receiptTagMap}
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
