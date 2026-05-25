"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PAGE_PATH } from "@/constants/pagePath";
import { useAuth } from "@/contexts/AuthContext";
import { aggregateLines } from "@/libs/receipt-aggregation";
import {
	type ExpenseType,
	getReceipt,
	getReceiptLines,
	getStores,
	getTags,
	getTagsForReceipt,
	isReceiptEditable,
	type Receipt,
	replaceReceiptLines,
	type Store,
	setReceiptTags,
	type Tag,
	updateReceipt,
} from "@/libs/storage";
import {
	type DraftLine,
	emptyDraftLine,
	normalizeLines,
	ReceiptLinesEditor,
} from "../../components/ReceiptLinesEditor";
import { TagPicker } from "../../components/TagPicker";

export default function EditReceiptPage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const { tksUser } = useAuth();
	const [receipt, setReceipt] = useState<Receipt | null>(null);
	const [stores, setStores] = useState<Store[]>([]);
	const [allTags, setAllTags] = useState<Tag[]>([]);
	const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
	const [isSaving, setIsSaving] = useState(false);
	const [linesDraft, setLinesDraft] = useState<DraftLine[]>([emptyDraftLine()]);
	const [expenseType, setExpenseType] = useState<ExpenseType>("petty_cash");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const myUserId = tksUser?.id ?? null;
		const myRole = tksUser?.role;
		const myStoreId = tksUser?.storeId ?? null;
		getReceipt(params.id).then((r) => {
			if (!r) {
				router.replace(PAGE_PATH.receipts);
				return;
			}
			if (myRole === "store_staff" && r.createdBy !== myUserId) {
				router.replace(PAGE_PATH.receipts);
				return;
			}
			if (myRole === "store_manager" && r.storeId !== myStoreId) {
				router.replace(PAGE_PATH.receipts);
				return;
			}
			// 承認済み・支払済みのレシートは改ざん防止のため編集不可
			if (!isReceiptEditable(r.status)) {
				router.replace(PAGE_PATH.receiptDetail(params.id));
				return;
			}
			setReceipt(r);
			setExpenseType(r.expenseType);
		});
		getStores().then(setStores);
		getTags().then(setAllTags);
		getTagsForReceipt(params.id).then(setSelectedTagIds);
		// 既存の明細を読み込む（無ければ空1行）
		getReceiptLines(params.id).then((lines) => {
			if (lines.length === 0) {
				setLinesDraft([emptyDraftLine()]);
				return;
			}
			setLinesDraft(
				lines.map((l) => ({
					taxRate: String(l.taxRate) as DraftLine["taxRate"],
					amountTaxIncl: String(l.amountTaxIncl),
					accountCategory: l.accountCategory,
					itemName: l.itemName ?? "",
					invoiceEligible: l.invoiceEligible,
				})),
			);
		});
	}, [params.id, router, tksUser?.id, tksUser?.role, tksUser?.storeId]);

	if (!receipt) return null;

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError(null);
		const normalized = normalizeLines(linesDraft);
		if (normalized.length === 0) {
			setError("明細を1行以上、有効な値で入力してください");
			return;
		}
		const fdRaw = new FormData(e.currentTarget);
		const purposeVal = ((fdRaw.get("purpose") as string) || "").trim();
		const participantsVal = (
			(fdRaw.get("participants") as string) || ""
		).trim();
		// 立替経費は目的・参加者が必須 (REQ-PE-03)
		if (expenseType === "personal" && (!purposeVal || !participantsVal)) {
			setError("立替経費(personal)は「目的」と「参加者」が必須です");
			return;
		}
		setIsSaving(true);
		const fd = new FormData(e.currentTarget);
		const agg = aggregateLines(
			normalized.map((l) => ({
				taxRate: l.taxRate,
				amountTaxIncl: l.amountTaxIncl,
			})),
		);
		const invoiceNo = (fd.get("invoiceRegistrationNo") as string) || null;
		const actorId = tksUser?.id ?? null;

		await updateReceipt(
			params.id,
			{
				date: (fd.get("date") as string) || null,
				payee: (fd.get("payee") as string) || null,
				amount: agg.amount,
				taxAmount: agg.taxAmount,
				taxRateCategory: agg.taxRateCategory,
				accountCategory: normalized[0].accountCategory,
				description: (fd.get("description") as string) || null,
				invoiceRegistrationNo: invoiceNo,
				invoiceStatus: invoiceNo ? "registered" : "unknown",
				itemName: ((fd.get("itemName") as string) || "").trim() || null,
				storeId: (fd.get("storeId") as string) || null,
				purpose: purposeVal || null,
				participants: participantsVal || null,
				expenseType,
				isAiVerified: true,
			},
			actorId,
		);
		await replaceReceiptLines(
			params.id,
			normalized.map((l, i) => ({
				lineNo: i + 1,
				taxRate: l.taxRate,
				amountTaxIncl: l.amountTaxIncl,
				accountCategory: l.accountCategory,
				itemName: l.itemName,
				invoiceEligible: l.invoiceEligible,
			})),
			actorId,
		);
		await setReceiptTags(params.id, selectedTagIds, actorId);

		window.location.href = PAGE_PATH.receiptDetail(params.id);
	};

	return (
		<div>
			<div className="mb-6 flex items-center gap-4">
				<Button
					render={<Link href={PAGE_PATH.receiptDetail(params.id)} />}
					nativeButton={false}
					variant="ghost"
					size="icon"
				>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<h1 className="text-2xl font-bold">レシート編集</h1>
			</div>

			<div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">レシート画像</CardTitle>
					</CardHeader>
					<CardContent>
						{/* biome-ignore lint/performance/noImgElement: base64 data URL */}
						<img
							src={receipt.imageUrl}
							alt="レシート"
							className="w-full rounded-lg border object-contain"
							style={{ maxHeight: "500px" }}
						/>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-lg">情報の編集</CardTitle>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-4">
							{/* Phase 5: 申請区分（店長のみ立替経費を選択可） */}
							{tksUser?.role === "store_manager" && (
								<div className="space-y-2">
									<Label htmlFor="expenseType">申請区分</Label>
									<NativeSelect
										id="expenseType"
										value={expenseType}
										onChange={(e) =>
											setExpenseType(e.target.value as ExpenseType)
										}
										options={[
											{
												value: "petty_cash",
												label: "小口現金（店舗の経費）",
											},
											{
												value: "personal",
												label: "店長立替（給与同時振込）",
											},
										]}
									/>
									{expenseType === "personal" && (
										<p className="text-xs text-muted-foreground">
											立替経費は給与同時振込で支給されます。目的と参加者は必須項目です。
										</p>
									)}
								</div>
							)}

							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="date">日付</Label>
									<Input
										id="date"
										name="date"
										type="date"
										defaultValue={receipt.date ?? ""}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="payee">支払先</Label>
									<Input
										id="payee"
										name="payee"
										defaultValue={receipt.payee ?? ""}
									/>
								</div>
							</div>

							{/* Phase 5: 税率・勘定科目混在に対応した明細編集 */}
							<ReceiptLinesEditor value={linesDraft} onChange={setLinesDraft} />

							<div className="space-y-2">
								<Label htmlFor="itemName">品目（一覧用代表値）</Label>
								<Input
									id="itemName"
									name="itemName"
									defaultValue={receipt.itemName ?? ""}
									placeholder="例: 文具一式・お茶"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="description">摘要・説明</Label>
								<Input
									id="description"
									name="description"
									defaultValue={receipt.description ?? ""}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="invoiceRegistrationNo">
									インボイス登録番号
								</Label>
								<Input
									id="invoiceRegistrationNo"
									name="invoiceRegistrationNo"
									defaultValue={receipt.invoiceRegistrationNo ?? ""}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="storeId">店舗</Label>
								<NativeSelect
									id="storeId"
									name="storeId"
									defaultValue={receipt.storeId ?? ""}
									placeholder="選択"
									options={stores.map((s) => ({
										value: s.id,
										label: s.name,
									}))}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="purpose">
									目的
									{expenseType === "personal" && (
										<span className="ml-1 text-destructive">*</span>
									)}
								</Label>
								<Input
									id="purpose"
									name="purpose"
									defaultValue={receipt.purpose ?? ""}
									placeholder="例: 顧客接待・社内会議など"
									required={expenseType === "personal"}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="participants">
									参加者
									{expenseType === "personal" && (
										<span className="ml-1 text-destructive">*</span>
									)}
								</Label>
								<Input
									id="participants"
									name="participants"
									defaultValue={receipt.participants ?? ""}
									placeholder="例: 山田太郎、田中花子"
									required={expenseType === "personal"}
								/>
							</div>
							<div className="space-y-2">
								<Label>タグ</Label>
								<TagPicker
									allTags={allTags}
									selectedIds={selectedTagIds}
									onChange={setSelectedTagIds}
								/>
							</div>
							{error && <p className="text-sm text-destructive">{error}</p>}
							<Button type="submit" className="w-full" disabled={isSaving}>
								{isSaving ? "更新中..." : "更新する"}
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
