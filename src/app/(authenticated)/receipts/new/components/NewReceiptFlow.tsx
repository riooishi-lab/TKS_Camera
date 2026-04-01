"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/libs/supabase/client";
import type { ReceiptExtraction } from "@/types/receipt";
import { createReceipt } from "../../actions/receiptActions";
import { ReceiptForm } from "../../components/ReceiptForm";
import { ImageCapture } from "./ImageCapture";

type Project = {
	id: string;
	name: string;
};

type NewReceiptFlowProps = {
	projects: Project[];
};

export function NewReceiptFlow({ projects }: NewReceiptFlowProps) {
	const [step, setStep] = useState<"capture" | "analyzing" | "form">("capture");
	const [_imageFile, setImageFile] = useState<File | null>(null);
	const [imageUrl, setImageUrl] = useState("");
	const [imagePath, setImagePath] = useState("");
	const [extraction, setExtraction] = useState<ReceiptExtraction | null>(null);
	const [aiRawResponse, setAiRawResponse] = useState<Record<
		string,
		unknown
	> | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleCapture = useCallback(async (file: File) => {
		setImageFile(file);
		setStep("analyzing");
		setError(null);

		try {
			// 1. Supabase Storageにアップロード
			const supabase = createClient();
			const filePath = `receipts/${Date.now()}-${file.name}`;

			const { error: uploadError } = await supabase.storage
				.from("receipt-images")
				.upload(filePath, file);

			if (uploadError) {
				throw new Error(`画像アップロードに失敗: ${uploadError.message}`);
			}

			const {
				data: { publicUrl },
			} = supabase.storage.from("receipt-images").getPublicUrl(filePath);

			setImageUrl(publicUrl);
			setImagePath(filePath);

			// 2. Gemini APIで解析
			const formData = new FormData();
			formData.append("file", file);

			const res = await fetch("/api/receipts/extract", {
				method: "POST",
				body: formData,
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || "AI解析に失敗しました");
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

	return (
		<div className="space-y-6">
			{/* ステップ1: 画像キャプチャ */}
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

			{/* ステップ2: フォーム入力 */}
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
						<ReceiptForm
							action={createReceipt}
							projects={projects}
							defaultValues={extraction}
							imageUrl={imageUrl}
							imagePath={imagePath}
							aiRawResponse={aiRawResponse}
							aiConfidence={extraction.confidence}
							submitLabel="レシートを登録"
							pendingLabel="登録中..."
						/>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
