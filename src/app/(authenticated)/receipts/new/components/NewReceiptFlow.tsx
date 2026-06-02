"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PAGE_PATH } from "@/constants/pagePath";
import { useAuth } from "@/contexts/AuthContext";
import { notifyReceiptEvent } from "@/libs/notifications";
import { aggregateLines } from "@/libs/receipt-aggregation";
import {
	type ExpenseType,
	fileToBase64,
	findDuplicateReceipts,
	getStores,
	getTags,
	type Receipt,
	replaceReceiptLines,
	type Store,
	saveReceipt,
	setReceiptTags,
	type Tag,
} from "@/libs/storage";
import type { ReceiptExtraction } from "@/types/receipt";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import {
	type DraftLine,
	emptyDraftLine,
	normalizeLines,
	ReceiptLinesEditor,
} from "../../components/ReceiptLinesEditor";
import { TagPicker } from "../../components/TagPicker";
import { ImageCapture } from "./ImageCapture";

const MAX_FILES = 5;

type SheetStatus =
	| "pending"
	| "analyzing"
	| "ready"
	| "saving"
	| "saved"
	| "error";

type ReceiptSheet = {
	id: string;
	file: File;
	imageBase64: string;
	status: SheetStatus;
	extraction: ReceiptExtraction | null;
	aiRawResponse: Record<string, unknown> | null;
	formValues: FormValues;
	selectedTagIds: string[];
	duplicates: Receipt[];
	dupAcknowledged: boolean;
	errorMessage: string | null;
};

type FormValues = {
	date: string;
	payee: string;
	itemName: string;
	description: string;
	invoiceRegistrationNo: string;
	storeId: string;
	purpose: string;
	participants: string;
	expenseType: ExpenseType;
	lines: DraftLine[];
};

function emptyForm(storeId = ""): FormValues {
	return {
		date: "",
		payee: "",
		itemName: "",
		description: "",
		invoiceRegistrationNo: "",
		storeId,
		purpose: "",
		participants: "",
		expenseType: "petty_cash",
		lines: [emptyDraftLine()],
	};
}

function applyExtraction(
	base: FormValues,
	extraction: ReceiptExtraction,
): FormValues {
	// AI が返した lines を編集用のドラフトに変換。
	// lines が空のケースは route.ts 側のフォールバックで合成されるはずだが、
	// 念のためここでも空配列なら 1行のドラフトを残す。
	const drafts: DraftLine[] = extraction.lines.length
		? extraction.lines.map((l) => ({
				taxRate: String(l.taxRate) as DraftLine["taxRate"],
				amountTaxIncl: String(l.amountTaxIncl),
				accountCategory: l.accountCategory ?? "雑費",
				itemName: l.itemName ?? "",
				invoiceEligible: true,
			}))
		: [emptyDraftLine()];
	return {
		...base,
		date: extraction.date ?? "",
		payee: extraction.payee ?? "",
		// 旧 description は摘要として残しつつ、品目はレシート単位の代表値として複合表示
		itemName: drafts
			.map((d) => d.itemName)
			.filter(Boolean)
			.join(", "),
		description: extraction.description ?? "",
		invoiceRegistrationNo: extraction.invoiceRegistrationNo ?? "",
		lines: drafts,
	};
}

function ReceiptFormFields({
	values,
	onChange,
	stores,
	canFilePersonal,
}: {
	values: FormValues;
	onChange: (next: FormValues) => void;
	stores: Store[];
	canFilePersonal: boolean;
}) {
	const set = <K extends keyof FormValues>(key: K, v: FormValues[K]) =>
		onChange({ ...values, [key]: v });
	const isPersonal = values.expenseType === "personal";
	return (
		<div className="space-y-4">
			{/* Phase 5: 申請区分。店長(store_manager) のみ立替経費を選択可能 */}
			{canFilePersonal && (
				<div className="space-y-2">
					<Label>申請区分</Label>
					<NativeSelect
						value={values.expenseType}
						onChange={(e) => set("expenseType", e.target.value as ExpenseType)}
						options={[
							{ value: "petty_cash", label: "小口現金（店舗の経費）" },
							{ value: "personal", label: "店長立替（給与同時振込）" },
						]}
					/>
					{isPersonal && (
						<p className="text-xs text-muted-foreground">
							立替経費は給与同時振込で支給されます。目的と参加者は必須項目です。
						</p>
					)}
				</div>
			)}

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label>日付</Label>
					<Input
						type="date"
						value={values.date}
						onChange={(e) => set("date", e.target.value)}
					/>
				</div>
				<div className="space-y-2">
					<Label>支払先</Label>
					<Input
						value={values.payee}
						onChange={(e) => set("payee", e.target.value)}
						placeholder="店舗名・会社名"
					/>
				</div>
			</div>

			{/* Phase 5: 税率・勘定科目混在に対応した明細編集 */}
			<ReceiptLinesEditor
				value={values.lines}
				onChange={(lines) => set("lines", lines)}
			/>

			<div className="space-y-2">
				<Label>品目（一覧用代表値）</Label>
				<Input
					value={values.itemName}
					onChange={(e) => set("itemName", e.target.value)}
					placeholder="例: 文具一式・お茶"
				/>
			</div>
			<div className="space-y-2">
				<Label>摘要・説明</Label>
				<Input
					value={values.description}
					onChange={(e) => set("description", e.target.value)}
				/>
			</div>
			<div className="space-y-2">
				<Label>インボイス登録番号</Label>
				<Input
					value={values.invoiceRegistrationNo}
					onChange={(e) => set("invoiceRegistrationNo", e.target.value)}
					placeholder="T1234567890123"
				/>
			</div>
			<div className="space-y-2">
				<Label>店舗</Label>
				<NativeSelect
					value={values.storeId}
					onChange={(e) => set("storeId", e.target.value)}
					placeholder="選択"
					options={stores.map((s) => ({ value: s.id, label: s.name }))}
				/>
			</div>
			<div className="space-y-2">
				<Label>
					目的{isPersonal && <span className="ml-1 text-destructive">*</span>}
				</Label>
				<Input
					value={values.purpose}
					onChange={(e) => set("purpose", e.target.value)}
					placeholder="例: 顧客接待・社内会議など"
					required={isPersonal}
				/>
			</div>
			<div className="space-y-2">
				<Label>
					参加者{isPersonal && <span className="ml-1 text-destructive">*</span>}
				</Label>
				<Input
					value={values.participants}
					onChange={(e) => set("participants", e.target.value)}
					placeholder="例: 山田太郎、田中花子"
					required={isPersonal}
				/>
			</div>
		</div>
	);
}

function DuplicateWarning({
	duplicates,
	acknowledged,
	onAcknowledge,
}: {
	duplicates: Receipt[];
	acknowledged: boolean;
	onAcknowledge: (v: boolean) => void;
}) {
	return (
		<div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
			<div className="flex items-start gap-2">
				<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
				<div className="flex-1">
					<p className="font-medium text-amber-900 dark:text-amber-200">
						同一の日付・支払先・金額のレシートが {duplicates.length}{" "}
						件登録済みです
					</p>
					<ul className="mt-1.5 space-y-0.5 text-xs text-amber-800 dark:text-amber-300">
						{duplicates.slice(0, 3).map((d) => (
							<li key={d.id}>
								・{d.date ? formatDate(d.date) : "-"} / {d.payee ?? "-"} /{" "}
								{d.amount != null ? formatCurrency(d.amount) : "-"}
							</li>
						))}
					</ul>
					<label className="mt-2 flex cursor-pointer items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200">
						<input
							type="checkbox"
							checked={acknowledged}
							onChange={(e) => onAcknowledge(e.target.checked)}
						/>
						重複を承知のうえで登録する
					</label>
				</div>
			</div>
		</div>
	);
}

export function NewReceiptFlow() {
	const { tksUser } = useAuth();
	const [sheets, setSheets] = useState<ReceiptSheet[]>([]);
	const [stores, setStores] = useState<Store[]>([]);
	const [allTags, setAllTags] = useState<Tag[]>([]);
	const [globalError, setGlobalError] = useState<string | null>(null);
	const [captureError, setCaptureError] = useState<string | null>(null);
	const [isSavingAll, setIsSavingAll] = useState(false);
	const [completeDialogOpen, setCompleteDialogOpen] = useState(false);

	useEffect(() => {
		getStores().then(setStores);
		getTags().then(setAllTags);
	}, []);

	const defaultStoreId = tksUser?.storeId ?? "";

	const updateSheet = useCallback(
		(id: string, patch: Partial<ReceiptSheet>) => {
			setSheets((prev) =>
				prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
			);
		},
		[],
	);

	const addFile = useCallback(
		(file: File) => {
			const id = crypto.randomUUID();
			setSheets((prev) => [
				...prev,
				{
					id,
					file,
					imageBase64: "",
					status: "pending",
					extraction: null,
					aiRawResponse: null,
					formValues: emptyForm(defaultStoreId),
					selectedTagIds: [],
					duplicates: [],
					dupAcknowledged: false,
					errorMessage: null,
				},
			]);
		},
		[defaultStoreId],
	);

	const removeFile = useCallback((index: number) => {
		setSheets((prev) => prev.filter((_, i) => i !== index));
	}, []);

	const analyzeSheet = useCallback(
		async (sheet: ReceiptSheet) => {
			try {
				updateSheet(sheet.id, { status: "analyzing", errorMessage: null });
				const base64 = await fileToBase64(sheet.file);

				const formData = new FormData();
				formData.append("file", sheet.file);
				const res = await fetch("/api/receipts/extract", {
					method: "POST",
					body: formData,
				});
				if (!res.ok) {
					// サーバーが返したエラー文言を最優先で拾う。
					// JSON でない（502/タイムアウト等）場合は本文の先頭やステータスを添える。
					const msg = await res
						.clone()
						.json()
						.then((d) => (typeof d?.error === "string" ? d.error : null))
						.catch(() => null);
					const fallback = await res
						.text()
						.then((t) => t.trim().slice(0, 200))
						.catch(() => "");
					throw new Error(
						msg ||
							`AI解析に失敗しました（HTTP ${res.status}${
								fallback ? `: ${fallback}` : ""
							}）`,
					);
				}
				const data = await res.json();
				const extraction: ReceiptExtraction = data.extraction;
				const nextValues = applyExtraction(
					emptyForm(defaultStoreId),
					extraction,
				);

				let duplicates: Receipt[] = [];
				if (extraction.date && extraction.payee && extraction.amount != null) {
					duplicates = await findDuplicateReceipts({
						date: extraction.date,
						payee: extraction.payee,
						amount: extraction.amount,
					});
				}

				updateSheet(sheet.id, {
					imageBase64: base64,
					extraction,
					aiRawResponse: data.rawResponse,
					formValues: nextValues,
					duplicates,
					status: "ready",
				});
			} catch (err) {
				// 原因を握り潰さず、可能な限り具体的な理由を画面に出す。
				// Error 以外が throw された場合も String 化して情報を残す。
				console.error("レシート解析エラー:", err);
				let errorMessage: string;
				if (err instanceof Error) {
					errorMessage = err.message || err.name || "エラーが発生しました";
					// ネットワーク断などの fetch 失敗は message が分かりにくいため補足する
					if (err.name === "TypeError" && /fetch/i.test(err.message)) {
						errorMessage =
							"サーバーに接続できませんでした。通信環境を確認して再試行してください。";
					}
				} else {
					errorMessage = String(err) || "エラーが発生しました";
				}
				updateSheet(sheet.id, { status: "error", errorMessage });
			}
		},
		[defaultStoreId, updateSheet],
	);

	const handleStartAnalysis = useCallback(async () => {
		setCaptureError(null);
		if (sheets.length === 0) {
			setCaptureError("画像を1枚以上追加してください");
			return;
		}
		for (const s of sheets) {
			if (s.status === "pending") {
				await analyzeSheet(s);
			}
		}
	}, [sheets, analyzeSheet]);

	const allReady = useMemo(
		() =>
			sheets.length > 0 &&
			sheets.every((s) => s.status === "ready" || s.status === "saved"),
		[sheets],
	);

	const hasPending = sheets.some(
		(s) => s.duplicates.length > 0 && !s.dupAcknowledged,
	);

	const handleSaveAll = async (skipAssignment = false) => {
		if (!allReady) return;
		if (hasPending) {
			setGlobalError("重複警告が未確認のレシートがあります");
			return;
		}
		setIsSavingAll(true);
		setGlobalError(null);
		// 店長(store_manager)の起票は pending を経ずに manager_approved を自動付与し、
		// 経理通知(manager_approved)に直結させる。Phase 5 設計 REQ-A-02 / US-2.2。
		const isManagerSelfFiling = tksUser?.role === "store_manager";
		const actorId = tksUser?.id ?? null;
		try {
			for (const s of sheets) {
				if (s.status === "saved") continue;
				updateSheet(s.id, { status: "saving" });
				const v = s.formValues;
				const normalizedLines = normalizeLines(v.lines);
				if (normalizedLines.length === 0) {
					updateSheet(s.id, {
						status: "ready",
						errorMessage: "明細を1行以上、有効な値で入力してください",
					});
					continue;
				}
				// 立替経費は目的・参加者が必須 (REQ-PE-03)
				if (
					v.expenseType === "personal" &&
					(!v.purpose.trim() || !v.participants.trim())
				) {
					updateSheet(s.id, {
						status: "ready",
						errorMessage: "立替経費(personal)は「目的」と「参加者」が必須です",
					});
					continue;
				}
				// 立替経費は店長のみ起票可能 (REQ-PE-02)
				if (v.expenseType === "personal" && !isManagerSelfFiling) {
					updateSheet(s.id, {
						status: "ready",
						errorMessage: "立替経費は店長のみ起票できます",
					});
					continue;
				}
				const agg = aggregateLines(
					normalizedLines.map((l) => ({
						taxRate: l.taxRate,
						amountTaxIncl: l.amountTaxIncl,
					})),
				);
				const now = new Date().toISOString();
				const invoiceNo = v.invoiceRegistrationNo || null;
				// 親 receipt の accountCategory は表示用代表値として lines の先頭から拾う
				const primaryCategory = normalizedLines[0].accountCategory;
				const saved = await saveReceipt(
					{
						storeId: skipAssignment
							? null
							: v.storeId || defaultStoreId || null,
						status: isManagerSelfFiling ? "manager_approved" : "pending",
						date: v.date || null,
						payee: v.payee || null,
						amount: agg.amount,
						taxAmount: agg.taxAmount,
						taxRateCategory: agg.taxRateCategory,
						accountCategory: primaryCategory,
						description: v.description || null,
						invoiceRegistrationNo: invoiceNo,
						purpose: skipAssignment ? null : v.purpose || null,
						participants: skipAssignment ? null : v.participants || null,
						imageUrl: s.imageBase64,
						aiRawResponse: s.aiRawResponse,
						aiConfidence: s.extraction?.confidence ?? null,
						isAiVerified: false,
						managerApprovedBy: isManagerSelfFiling ? actorId : null,
						managerApprovedAt: isManagerSelfFiling ? now : null,
						submittedAt: now,
						expenseType: v.expenseType,
						invoiceStatus: invoiceNo ? "registered" : "unknown",
						itemName: v.itemName.trim() || null,
						imageMetadata: null,
					},
					actorId,
				);
				// 明細を保存（receipts の集計値は既に保存済みのため再計算は不要だが、
				// 整合性確保のため replaceReceiptLines 経由で1段階で書き込む）
				await replaceReceiptLines(
					saved.id,
					normalizedLines.map((l, i) => ({
						lineNo: i + 1,
						taxRate: l.taxRate,
						amountTaxIncl: l.amountTaxIncl,
						accountCategory: l.accountCategory,
						itemName: l.itemName,
						invoiceEligible: l.invoiceEligible,
					})),
					actorId,
				);
				if (s.selectedTagIds.length > 0) {
					await setReceiptTags(saved.id, s.selectedTagIds, actorId);
				}
				// 通知: 通常は店舗管理者へ申請通知。
				// 店長自身が起票した場合は manager_approved として経理へ通知する。
				void notifyReceiptEvent({
					receipt: saved,
					event: isManagerSelfFiling ? "manager_approved" : "submitted",
					actorId,
				});
				updateSheet(s.id, { status: "saved" });
			}
			setCompleteDialogOpen(true);
		} catch (err) {
			setSheets((prev) =>
				prev.map((s) =>
					s.status === "saving" ? { ...s, status: "ready" } : s,
				),
			);
			setGlobalError(err instanceof Error ? err.message : "保存に失敗しました");
		} finally {
			setIsSavingAll(false);
		}
	};

	const anyAnalyzing = sheets.some((s) => s.status === "analyzing");
	const anyReadyOrSaved = sheets.some(
		(s) => s.status === "ready" || s.status === "saved",
	);

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">
						1. レシート画像（最大{MAX_FILES}枚）
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<ImageCapture
						files={sheets.map((s) => s.file)}
						maxFiles={MAX_FILES}
						onAdd={addFile}
						onRemove={removeFile}
						onSubmit={handleStartAnalysis}
						disabled={anyReadyOrSaved || anyAnalyzing}
					/>
					{captureError && (
						<p className="text-sm text-destructive">{captureError}</p>
					)}
					{anyAnalyzing && (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin" />
							AIがレシートを読み取っています...
						</div>
					)}
				</CardContent>
			</Card>

			{sheets.map((sheet, idx) => {
				if (sheet.status === "pending" || sheet.status === "analyzing") {
					return null;
				}
				if (sheet.status === "error") {
					return (
						<Card key={sheet.id} className="border-destructive">
							<CardHeader>
								<CardTitle className="text-base">
									{idx + 1}枚目: 解析エラー
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="whitespace-pre-wrap break-words text-sm text-destructive">
									{sheet.errorMessage ?? "不明なエラー"}
								</p>
								<Button
									variant="outline"
									size="sm"
									className="mt-2"
									onClick={() => analyzeSheet(sheet)}
								>
									再試行
								</Button>
							</CardContent>
						</Card>
					);
				}

				return (
					<Card key={sheet.id}>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle className="text-base">{idx + 1}枚目の確認</CardTitle>
								<div className="flex items-center gap-2">
									{sheet.status === "saved" && (
										<Badge variant="default">
											<CheckCircle2 className="mr-1 h-3 w-3" />
											保存済
										</Badge>
									)}
									{sheet.extraction?.confidence != null && (
										<Badge variant="secondary">
											信頼度: {Math.round(sheet.extraction.confidence * 100)}%
										</Badge>
									)}
								</div>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							{sheet.duplicates.length > 0 && (
								<DuplicateWarning
									duplicates={sheet.duplicates}
									acknowledged={sheet.dupAcknowledged}
									onAcknowledge={(v) =>
										updateSheet(sheet.id, { dupAcknowledged: v })
									}
								/>
							)}
							<ReceiptFormFields
								values={sheet.formValues}
								onChange={(v) => updateSheet(sheet.id, { formValues: v })}
								stores={stores}
								canFilePersonal={tksUser?.role === "store_manager"}
							/>
							<div className="space-y-2">
								<Label>タグ</Label>
								<TagPicker
									allTags={allTags}
									selectedIds={sheet.selectedTagIds}
									onChange={(ids) =>
										updateSheet(sheet.id, { selectedTagIds: ids })
									}
								/>
							</div>
						</CardContent>
					</Card>
				);
			})}

			{anyReadyOrSaved && (
				<Card>
					<CardContent className="space-y-2 pt-6">
						<Button
							className="w-full"
							onClick={() => handleSaveAll(false)}
							disabled={isSavingAll || !allReady || hasPending}
						>
							{isSavingAll ? "登録中..." : `${sheets.length}件をまとめて登録`}
						</Button>
						<Button
							variant="outline"
							className="w-full"
							onClick={() => handleSaveAll(true)}
							disabled={isSavingAll || !allReady || hasPending}
						>
							未割当で登録（店舗・目的・参加者なし）
						</Button>
						<p className="text-center text-xs text-muted-foreground">
							未割当で登録したレシートは、後から編集画面で割り振りできます
						</p>
					</CardContent>
				</Card>
			)}

			<Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>登録完了</DialogTitle>
						<DialogDescription>
							{sheets.length}件のレシートを登録しました。
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							onClick={() => {
								window.location.href = PAGE_PATH.receipts;
							}}
						>
							一覧へ戻る
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={globalError !== null}
				onOpenChange={(open) => {
					if (!open) setGlobalError(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<AlertTriangle className="h-5 w-5 text-destructive" />
							登録に失敗しました
						</DialogTitle>
						<DialogDescription className="break-words whitespace-pre-wrap text-destructive">
							{globalError}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setGlobalError(null)}>
							閉じる
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
