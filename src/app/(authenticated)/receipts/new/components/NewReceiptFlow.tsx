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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ACCOUNT_CATEGORIES } from "@/constants/accountCategories";
import { PAGE_PATH } from "@/constants/pagePath";
import { useAuth } from "@/contexts/AuthContext";
import {
	type Client,
	fileToBase64,
	findDuplicateReceipts,
	getClients,
	getProjects,
	getStaff,
	getTags,
	type Project,
	type Receipt,
	type Staff,
	saveReceipt,
	setReceiptTags,
	type Tag,
} from "@/libs/storage";
import type { ReceiptExtraction } from "@/types/receipt";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
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
	amount: string;
	taxAmount: string;
	taxRateCategory: string;
	accountCategory: string;
	description: string;
	invoiceRegistrationNo: string;
	projectId: string;
	clientId: string;
	personInCharge: string;
};

function emptyForm(personInCharge = ""): FormValues {
	return {
		date: "",
		payee: "",
		amount: "",
		taxAmount: "",
		taxRateCategory: "",
		accountCategory: "",
		description: "",
		invoiceRegistrationNo: "",
		projectId: "",
		clientId: "",
		personInCharge,
	};
}

function applyExtraction(
	base: FormValues,
	extraction: ReceiptExtraction,
): FormValues {
	return {
		...base,
		date: extraction.date ?? "",
		payee: extraction.payee ?? "",
		amount: extraction.amount != null ? String(extraction.amount) : "",
		taxAmount: extraction.taxAmount != null ? String(extraction.taxAmount) : "",
		taxRateCategory: extraction.taxRateCategory ?? "",
		accountCategory: extraction.accountCategory ?? "",
		description: extraction.description ?? "",
		invoiceRegistrationNo: extraction.invoiceRegistrationNo ?? "",
	};
}

function ReceiptFormFields({
	values,
	onChange,
	projects,
	clients,
	staffList,
}: {
	values: FormValues;
	onChange: (next: FormValues) => void;
	projects: Project[];
	clients: Client[];
	staffList: Staff[];
}) {
	const set = <K extends keyof FormValues>(key: K, v: FormValues[K]) =>
		onChange({ ...values, [key]: v });
	return (
		<div className="space-y-4">
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
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label>金額（税込）</Label>
					<Input
						type="number"
						value={values.amount}
						onChange={(e) => set("amount", e.target.value)}
					/>
				</div>
				<div className="space-y-2">
					<Label>消費税額</Label>
					<Input
						type="number"
						value={values.taxAmount}
						onChange={(e) => set("taxAmount", e.target.value)}
					/>
				</div>
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label>税率区分</Label>
					<Select
						value={values.taxRateCategory}
						onValueChange={(v) => set("taxRateCategory", (v as string) ?? "")}
					>
						<SelectTrigger>
							<SelectValue placeholder="選択" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="10">標準税率 (10%)</SelectItem>
							<SelectItem value="8">軽減税率 (8%)</SelectItem>
							<SelectItem value="mixed">混在</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label>勘定科目</Label>
					<Select
						value={values.accountCategory}
						onValueChange={(v) => set("accountCategory", (v as string) ?? "")}
					>
						<SelectTrigger>
							<SelectValue placeholder="選択" />
						</SelectTrigger>
						<SelectContent>
							{ACCOUNT_CATEGORIES.map((c) => (
								<SelectItem key={c.value} value={c.value}>
									{c.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
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
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label>プロジェクト</Label>
					<NativeSelect
						value={values.projectId}
						onChange={(e) => set("projectId", e.target.value)}
						placeholder="選択"
						options={projects.map((p) => ({ value: p.id, label: p.name }))}
					/>
				</div>
				<div className="space-y-2">
					<Label>顧客企業</Label>
					<NativeSelect
						value={values.clientId}
						onChange={(e) => set("clientId", e.target.value)}
						placeholder="選択"
						options={clients.map((c) => ({ value: c.id, label: c.name }))}
					/>
				</div>
			</div>
			<div className="space-y-2">
				<Label>担当者</Label>
				<NativeSelect
					value={values.personInCharge}
					onChange={(e) => set("personInCharge", e.target.value)}
					placeholder="選択"
					options={staffList.map((s) => ({ value: s.name, label: s.name }))}
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
	const [projects, setProjects] = useState<Project[]>([]);
	const [clients, setClients] = useState<Client[]>([]);
	const [staffList, setStaffList] = useState<Staff[]>([]);
	const [allTags, setAllTags] = useState<Tag[]>([]);
	const [globalError, setGlobalError] = useState<string | null>(null);
	const [captureError, setCaptureError] = useState<string | null>(null);
	const [isSavingAll, setIsSavingAll] = useState(false);
	const [completeDialogOpen, setCompleteDialogOpen] = useState(false);

	useEffect(() => {
		getProjects().then(setProjects);
		getClients().then(setClients);
		getStaff().then(setStaffList);
		getTags().then(setAllTags);
	}, []);

	const defaultPersonInCharge = tksUser?.name ?? "";

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
					formValues: emptyForm(defaultPersonInCharge),
					selectedTagIds: [],
					duplicates: [],
					dupAcknowledged: false,
					errorMessage: null,
				},
			]);
		},
		[defaultPersonInCharge],
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
					const msg = await res
						.json()
						.then((d) => d.error || "AI解析に失敗しました")
						.catch(() => "AI解析に失敗しました");
					throw new Error(msg);
				}
				const data = await res.json();
				const extraction: ReceiptExtraction = data.extraction;
				const nextValues = applyExtraction(
					emptyForm(defaultPersonInCharge),
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
				updateSheet(sheet.id, {
					status: "error",
					errorMessage:
						err instanceof Error ? err.message : "エラーが発生しました",
				});
			}
		},
		[defaultPersonInCharge, updateSheet],
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

	const handleSaveAll = async () => {
		if (!allReady) return;
		if (hasPending) {
			setGlobalError("重複警告が未確認のレシートがあります");
			return;
		}
		setIsSavingAll(true);
		setGlobalError(null);
		try {
			for (const s of sheets) {
				if (s.status === "saved") continue;
				updateSheet(s.id, { status: "saving" });
				const v = s.formValues;
				const saved = await saveReceipt(
					{
						date: v.date || null,
						payee: v.payee || null,
						amount: v.amount ? Math.round(Number(v.amount)) : null,
						taxAmount: v.taxAmount ? Math.round(Number(v.taxAmount)) : null,
						taxRateCategory: (v.taxRateCategory || null) as
							| "8"
							| "10"
							| "mixed"
							| null,
						accountCategory: v.accountCategory || null,
						description: v.description || null,
						invoiceRegistrationNo: v.invoiceRegistrationNo || null,
						projectId: v.projectId || null,
						clientId: v.clientId || null,
						personInCharge: v.personInCharge || null,
						imageUrl: s.imageBase64,
						aiRawResponse: s.aiRawResponse,
						aiConfidence: s.extraction?.confidence ?? null,
						isAiVerified: false,
					},
					tksUser?.id ?? null,
				);
				if (s.selectedTagIds.length > 0) {
					await setReceiptTags(saved.id, s.selectedTagIds, tksUser?.id ?? null);
				}
				updateSheet(s.id, { status: "saved" });
			}
			setCompleteDialogOpen(true);
		} catch (err) {
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
								<p className="text-sm text-destructive">
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
								projects={projects}
								clients={clients}
								staffList={staffList}
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
					<CardContent className="pt-6">
						{globalError && (
							<p className="mb-3 text-sm text-destructive">{globalError}</p>
						)}
						<Button
							className="w-full"
							onClick={handleSaveAll}
							disabled={isSavingAll || !allReady || hasPending}
						>
							{isSavingAll ? "登録中..." : `${sheets.length}件をまとめて登録`}
						</Button>
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
		</div>
	);
}
