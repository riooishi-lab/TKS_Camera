import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import type { ReceiptExtraction } from "@/types/receipt";

const EXTRACTION_PROMPT = `あなたはレシート・領収書の読み取り専門AIです。
画像からレシート情報を正確に抽出してください。

以下のJSON形式で回答してください（JSONのみ、説明不要）:
{
  "date": "YYYY-MM-DD形式の日付（読み取れない場合はnull）",
  "payee": "支払先・店舗名（読み取れない場合はnull）",
  "amount": 合計金額（税込、整数。読み取れない場合はnull）,
  "taxAmount": 消費税額（整数。読み取れない場合はnull）,
  "taxRateCategory": "8"か"10"か"mixed"（軽減税率8%、標準税率10%、混在。判定不能ならnull）,
  "accountCategory": "勘定科目の推定（交通費/旅費交通費/交際費/会議費/消耗品費/通信費/福利厚生費/広告宣伝費/外注費/雑費のいずれか。推定不能ならnull）",
  "description": "支出内容の簡潔な説明（推定不能ならnull）",
  "invoiceRegistrationNo": "インボイス登録番号 T+13桁の数字（記載がない場合はnull）",
  "confidence": 0.0〜1.0の信頼度スコア
}`;

export async function POST(request: Request) {
	try {
		const apiKey = process.env.GEMINI_API_KEY;
		if (!apiKey) {
			return NextResponse.json(
				{ error: "GEMINI_API_KEYが設定されていません" },
				{ status: 500 },
			);
		}

		const formData = await request.formData();
		const file = formData.get("file") as File | null;

		if (!file) {
			return NextResponse.json(
				{ error: "ファイルが選択されていません" },
				{ status: 400 },
			);
		}

		const arrayBuffer = await file.arrayBuffer();
		const base64 = Buffer.from(arrayBuffer).toString("base64");
		const mimeType = file.type;

		const genAI = new GoogleGenerativeAI(apiKey);
		const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

		const result = await model.generateContent([
			EXTRACTION_PROMPT,
			{
				inlineData: {
					data: base64,
					mimeType,
				},
			},
		]);

		const responseText = result.response.text();
		const jsonMatch = responseText.match(/\{[\s\S]*\}/);

		if (!jsonMatch) {
			return NextResponse.json(
				{ error: "AIからの応答を解析できませんでした" },
				{ status: 500 },
			);
		}

		const extraction: ReceiptExtraction = JSON.parse(jsonMatch[0]);

		return NextResponse.json({
			extraction,
			rawResponse: JSON.parse(jsonMatch[0]),
		});
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "不明なエラーが発生しました";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
