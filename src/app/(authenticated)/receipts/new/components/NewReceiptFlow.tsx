"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
	type Client,
	type Project,
	type Staff,
	fileToBase64,
	getClients,
	getProjects,
	getStaff,
	saveReceipt,
} from "@/libs/storage";
import type { ReceiptExtraction } from "@/types/receipt";
import { ImageCapture } from "./ImageCapture";

export function NewReceiptFlow() {
	const router = useRouter();
	const [step, setStep] = useState<"capture" | "analyzing" | "form">(
		"capture",
	);
	const [imageBase64, setImageBase64] = useState("");
	const [extraction, setExtraction] = useState<ReceiptExtraction | null>(null);
	const [aiRawResponse, setAiRawResponse] = useState<Record<
		string,
		unknown
	> | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [projects] = useState<Project[]>(() => getProjects());
	const [clients] = useState<Client[]>(() => getClients());
	const [staffList] = useState<Staff[]>(() => getStaff());

	const handleCapture = useCallback(async (file: File) => {
		setStep("analyzing");
		setError(null);

		try {
			const base64 = await fileToBase64(file);
			setImageBase64(base64);

			const formData = new FormData();
			formData.append("file", file);

			const res = await fetch("/api/receipts/extract", {
				method: "POST",
				body: formData,
			});

			if (!res.ok) {
				let message = "AI解析に失敗しました";
				try {
					const data = await res.json();
					message = data.error || message;
				} catch {
					// JSON解析失敗時はデフォルトメッセージ
				}
				throw new Error(message);
			}

			const data = await res.json();
			setExtraction(data.extraction);
			setAiRawResponse(data.rawResponse);
			setStep("form");
		} catch (err) {
			setError(err instanceof Error ? err.message : "エラーが発生しました");
			setStep("capture");
		}
	}, []);

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setIsSaving(true);
		const fd = new FormData(e.currentTarget);

		const amountStr = fd.get("amount") as string;
		const taxAmountStr = fd.get("taxAmount") as string;

		saveReceipt({
			date: (fd.get("date") as string) || null,
			payee: (fd.get("payee") as string) || null,
			amount: amountStr ? Number.parseInt(amountStr, 10) : null,
			taxAmount: taxAmountStr ? Number.parseInt(taxAmountStr, 10) : null,
			taxRateCategory:
				(fd.get("taxRateCategory") as "8" | "10" | "mixed") || null,
			accountCategory: (fd.get("accountCategory") as string) || null,
			description: (fd.get("description") as string) || null,
			invoiceRegistrationNo:
				(fd.get("invoiceRegistrationNo") as string) || null,
			projectId: (fd.get("projectId") as string) || null,
			clientId: (fd.get("clientId") as string) || null,
			personInCharge: (fd.get("personInCharge") as string) || null,
			imageUrl: imageBase64,
			imagePath: "",
			aiRawResponse,
			aiConfidence: extraction?.confidence ?? null,
			isAiVerified: false,
		});

		router.push(PAGE_PATH.receipts);
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">
						{step === "capture" && "1. レシート画像"}
						{step === "analyzing" && "1. AI解析中..."}
						{step === "form" && "1. レシート画像"}
					</CardTitle>
				</CardHeader>
				<CardContent>
					{step === "analyzing" ? (
						<div className="flex flex-col items-center gap-3 py-8">
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
							<p className="text-sm text-muted-foreground">
								AIがレシートを読み取っています...
							</p>
						</div>
					) : (
						<ImageCapture
							onCapture={handleCapture}
							disabled={step === "form"}
						/>
					)}
					{error && <p className="mt-3 text-sm text-destructive">{error}</p>}
				</CardContent>
			</Card>

			{step === "form" && extraction && (
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle className="text-lg">2. 読取結果の確認</CardTitle>
							{extraction.confidence != null && (
								<Badge variant="secondary">
									信頼度: {Math.round(extraction.confidence * 100)}%
								</Badge>
							)}
						</div>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="date">日付</Label>
									<Input
										id="date"
										name="date"
										type="date"
										defaultValue={extraction.date ?? ""}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="payee">支払先</Label>
									<Input
										id="payee"
										name="payee"
										defaultValue={extraction.payee ?? ""}
										placeholder="店舗名・会社名"
									/>
								</div>
							</div>
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="amount">金額（税込）</Label>
									<Input
										id="amount"
										name="amount"
										type="number"
										defaultValue={extraction.amount ?? ""}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="taxAmount">消費税額</Label>
									<Input
										id="taxAmount"
										name="taxAmount"
										type="number"
										defaultValue={extraction.taxAmount ?? ""}
									/>
								</div>
							</div>
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="taxRateCategory">税率区分</Label>
									<Select
										name="taxRateCategory"
										defaultValue={extraction.taxRateCategory ?? ""}
									>
										<SelectTrigger id="taxRateCategory">
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
									<Label htmlFor="accountCategory">勘定科目</Label>
									<Select
										name="accountCategory"
										defaultValue={extraction.accountCategory ?? ""}
									>
										<SelectTrigger id="accountCategory">
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
								<Label htmlFor="description">摘要・説明</Label>
								<Input
									id="description"
									name="description"
									defaultValue={extraction.description ?? ""}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="invoiceRegistrationNo">
									インボイス登録番号
								</Label>
								<Input
									id="invoiceRegistrationNo"
									name="invoiceRegistrationNo"
									defaultValue={extraction.invoiceRegistrationNo ?? ""}
									placeholder="T1234567890123"
								/>
							</div>
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="projectId">プロジェクト</Label>
									<NativeSelect
										id="projectId"
										name="projectId"
										defaultValue=""
										placeholder="選択"
										options={projects.map((p) => ({
											value: p.id,
											label: p.name,
										}))}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="clientId">顧客企業</Label>
									<NativeSelect
										id="clientId"
										name="clientId"
										defaultValue=""
										placeholder="選択"
										options={clients.map((c) => ({
											value: c.id,
											label: c.name,
										}))}
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="personInCharge">担当者</Label>
								<NativeSelect
									id="personInCharge"
									name="personInCharge"
									defaultValue=""
									placeholder="選択"
									options={staffList.map((s) => ({
										value: s.name,
										label: s.name,
									}))}
								/>
							</div>
							<Button type="submit" className="w-full" disabled={isSaving}>
								{isSaving ? "登録中..." : "レシートを登録"}
							</Button>
						</form>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
