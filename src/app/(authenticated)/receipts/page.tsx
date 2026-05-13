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
	getReceipts,
	getReceiptTags,
	getStores,
	getTags,
	getUsers,
	type Receipt,
	type ReceiptStatus,
	type Store,
	type Tag,
	type TksUser,
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
	| "store"
	| "applicant"
	| "purpose"
	| "participants"
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
	{ key: "store", label: "店舗", defaultVisible: true },
	{ key: "applicant", label: "申請者", defaultVisible: true },
	{ key: "purpose", label: "目的", defaultVisible: false },
	{ key: "participants", label: "参加者", defaultVisible: false },
	{ key: "description", label: "摘要", defaultVisible: false },
	{ key: "taxAmount", label: "税額", defaultVisible: false, align: "right" },
	{ key: "tags", label: "タグ", defaultVisible: false },
	{ key: "status", label: "状態", defaultVisible: true },
];

const STORAGE_KEY = "receipt-list-columns";

const STATUS_LABELS: Record<ReceiptStatus, string> = {
	pending: "申請中",
	manager_approved: "店長承認済",
	accountant_approved: "経理承認済",
	approved: "全承認済",
	rejected: "差戻し",
	paid: "支払済",
};

const STATUS_VARIANTS: Record<
	ReceiptStatus,
	"default" | "secondary" | "destructive" | "outline"
> = {
	pending: "secondary",
	manager_approved: "secondary",
	accountant_approved: "secondary",
	approved: "default",
	rejected: "destructive",
	paid: "outline",
};

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
	storeMap,
	userMap,
	tagMap,
	receiptTagMap,
}: {
	col: ColumnKey;
	receipt: Receipt;
	storeMap: Map<string, string>;
	userMap: Map<string, TksUser>;
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
		case "store":
			return receipt.storeId ? (storeMap.get(receipt.storeId) ?? "-") : "-";
		case "applicant": {
			if (!receipt.createdBy) return "-";
			const u = userMap.get(receipt.createdBy);
			return u?.name ?? u?.email ?? "-";
		}
		case "purpose":
			return receipt.purpose ?? "-";
		case "participants":
			return receipt.participants ?? "-";
		case "description":
			return receipt.description ?? "-";
		case "tags": {
			const ids = receiptTagMap.get(receipt.id) ?? [];
			const tags = ids.map((id) => tagMap.get(id)).filter((t): t is Tag => !!t);
			return <TagBadges tags={tags} />;
		}
		case "status":
			return (
				<Badge variant={STATUS_VARIANTS[receipt.status]}>
					{STATUS_LABELS[receipt.status]}
				</Badge>
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
	storeId: string;
	status: string;
	payeeQuery: string;
	amountMin: string;
	amountMax: string;
	tagIds: string[];
};

function FilterBar({
	filters,
	setFilters,
	months,
	stores,
	tags,
}: {
	filters: FilterState;
	setFilters: (updater: (prev: FilterState) => FilterState) => void;
	months: string[];
	stores: Store[];
	tags: Tag[];
}) {
	const hasFilter =
		filters.month ||
		filters.storeId ||
		filters.status ||
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
					value={filters.storeId}
					onChange={(v) => setFilters((p) => ({ ...p, storeId: v }))}
					placeholder="全店舗"
					options={stores.map((s) => ({ value: s.id, label: s.name }))}
				/>
				<FilterSelect
					value={filters.status}
					onChange={(v) => setFilters((p) => ({ ...p, status: v }))}
					placeholder="全状態"
					options={[
						{ value: "pending", label: STATUS_LABELS.pending },
						{
							value: "manager_approved",
							label: STATUS_LABELS.manager_approved,
						},
						{
							value: "accountant_approved",
							label: STATUS_LABELS.accountant_approved,
						},
						{ value: "approved", label: STATUS_LABELS.approved },
						{ value: "rejected", label: STATUS_LABELS.rejected },
						{ value: "paid", label: STATUS_LABELS.paid },
					]}
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
								storeId: "",
								status: "",
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
	storeMap,
	userMap,
	tagMap,
	receiptTagMap,
}: {
	receipts: Receipt[];
	columns: ColumnDef[];
	storeMap: Map<string, string>;
	userMap: Map<string, TksUser>;
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
										storeMap={storeMap}
										userMap={userMap}
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
	storeMap: Map<string, string>;
	userMap: Map<string, TksUser>;
	tagMap: Map<string, Tag>;
	receiptTagMap: Map<string, string[]>;
}) {
	const { receipts, storeMap, userMap, tagMap, receiptTagMap } = params;
	const header = [
		"日付",
		"支払先",
		"金額(税込)",
		"消費税額",
		"税率区分",
		"勘定科目",
		"摘要",
		"インボイス登録番号",
		"目的",
		"参加者",
		"店舗",
		"申請者",
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
			r.purpose ?? "",
			r.participants ?? "",
			r.storeId ? (storeMap.get(r.storeId) ?? "") : "",
			r.createdBy
				? (userMap.get(r.createdBy)?.name ??
					userMap.get(r.createdBy)?.email ??
					"")
				: "",
			tagNames,
			STATUS_LABELS[r.status],
			r.createdAt,
		];
	});
	const csv = toCsv([header, ...body]);
	const stamp = new Date().toISOString().slice(0, 10);
	downloadCsv(`receipts_${stamp}.csv`, csv);
}

export default function ReceiptsPage() {
	const { tksUser } = useAuth();
	const isStaff = tksUser?.role === "staff";
	const canCreate = isStaff;
	const [receipts, setReceipts] = useState<Receipt[]>([]);
	const [stores, setStores] = useState<Store[]>([]);
	const [users, setUsers] = useState<TksUser[]>([]);
	const [tags, setTags] = useState<Tag[]>([]);
	const [receiptTagMap, setReceiptTagMap] = useState<Map<string, string[]>>(
		new Map(),
	);

	const [filters, setFilters] = useState<FilterState>({
		month: "",
		storeId: "",
		status: "",
		payeeQuery: "",
		amountMin: "",
		amountMax: "",
		tagIds: [],
	});

	const [visibleCols, setVisibleCols] =
		useState<Set<ColumnKey>>(loadVisibleColumns);
	const [showColSettings, setShowColSettings] = useState(false);

	useEffect(() => {
		const myUserId = tksUser?.id ?? null;
		const myRole = tksUser?.role;
		const myStoreId = tksUser?.storeId ?? null;
		getReceipts().then((all) => {
			if (myRole === "staff") {
				setReceipts(all.filter((r) => r.createdBy === myUserId));
			} else if (myRole === "store_manager") {
				setReceipts(all.filter((r) => r.storeId === myStoreId));
			} else {
				setReceipts(all);
			}
		});
		getStores().then(setStores);
		getUsers().then(setUsers);
		getTags().then(setTags);
		getReceiptTags().then(setReceiptTagMap);
	}, [tksUser?.id, tksUser?.role, tksUser?.storeId]);

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

	const storeMap = useMemo(() => {
		const m = new Map<string, string>();
		for (const s of stores) m.set(s.id, s.name);
		return m;
	}, [stores]);
	const userMap = useMemo(() => {
		const m = new Map<string, TksUser>();
		for (const u of users) m.set(u.id, u);
		return m;
	}, [users]);
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
			if (filters.storeId && r.storeId !== filters.storeId) return false;
			if (filters.status && r.status !== filters.status) return false;
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
		filters.storeId ||
		filters.status ||
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
								storeMap,
								userMap,
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
						<Button
							render={<Link href={PAGE_PATH.receiptNew} />}
							nativeButton={false}
						>
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
				stores={stores}
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
					storeMap={storeMap}
					userMap={userMap}
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
							nativeButton={false}
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
