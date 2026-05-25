import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import type { ReceiptExtraction, ReceiptExtractionLine } from "@/types/receipt";

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
  "confidence": 0.0〜1.0の信頼度スコア,
  "lines": [
    {
      "taxRate": 10 または 8 または 0 （税率%、整数）,
      "amountTaxIncl": 当該明細の税込金額（整数）,
      "accountCategory": "勘定科目の推定（上記候補から1つ。推定不能なら null）",
      "itemName": "品目名・商品名（例: 弁当, ボールペン, 文具一式。推定不能なら null）"
    }
  ]
}

【lines の作り方】
- 単一税率・単一勘定の通常レシート: lines は1件のみ
- コンビニ等で 8% と 10% が混在: 税率ごとに1件ずつまとめる（最低2件）
- 同じ税率でも勘定科目が分かれる場合（例: 文具と飲み物）: 勘定科目ごとに分ける
- 合計の "amount" は lines の amountTaxIncl 合計と必ず一致させる
- 確実に判定できない明細はまとめてしまってよい`;

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
		const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

		const raw: unknown = JSON.parse(jsonMatch[0]);
		const extraction = normalizeExtraction(raw);

		return NextResponse.json({
			extraction,
			rawResponse: raw,
		});
	} catch (err) {
		const raw = err instanceof Error ? err.message : String(err);
		console.error("Gemini API error:", raw);
		let message = raw || "不明なエラーが発生しました";
		if (raw.includes("429") || raw.includes("Too Many Requests")) {
			message =
				"リクエストが多すぎます。しばらく待ってからもう一度お試しください。";
		} else if (raw.includes("API key") || raw.includes("API_KEY_INVALID")) {
			message = "APIキーが無効です。設定を確認してください。";
		}
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

// AI レスポンスの形を正規化する。
// lines が無い・空・型崩れ等の場合は、従来のフラットなフィールドから
// 1行のみの lines を合成して必ず1件以上にする (REQ-RC-01)。
function normalizeExtraction(raw: unknown): ReceiptExtraction {
	const r = (raw ?? {}) as Record<string, unknown>;
	const rawLines = Array.isArray(r.lines) ? (r.lines as unknown[]) : [];
	const lines: ReceiptExtractionLine[] = rawLines
		.map((l) => normalizeLine(l))
		.filter((l): l is ReceiptExtractionLine => l !== null);

	const amount = typeof r.amount === "number" ? r.amount : null;
	const fallbackCategory =
		typeof r.accountCategory === "string" ? r.accountCategory : null;
	const fallbackTaxRate = parseTaxRate(r.taxRateCategory);
	const fallbackItemName =
		typeof r.description === "string" ? r.description : null;

	if (lines.length === 0 && amount != null && fallbackTaxRate != null) {
		// AI が lines を返さなかった旧形式レスポンスへのフォールバック
		lines.push({
			taxRate: fallbackTaxRate,
			amountTaxIncl: amount,
			accountCategory: fallbackCategory,
			itemName: fallbackItemName,
		});
	}

	return {
		date: typeof r.date === "string" ? r.date : null,
		payee: typeof r.payee === "string" ? r.payee : null,
		amount,
		taxAmount: typeof r.taxAmount === "number" ? r.taxAmount : null,
		taxRateCategory: parseTaxRateCategory(r.taxRateCategory),
		accountCategory: fallbackCategory,
		description: typeof r.description === "string" ? r.description : null,
		invoiceRegistrationNo:
			typeof r.invoiceRegistrationNo === "string"
				? r.invoiceRegistrationNo
				: null,
		confidence: typeof r.confidence === "number" ? r.confidence : 0,
		lines,
	};
}

function normalizeLine(raw: unknown): ReceiptExtractionLine | null {
	if (!raw || typeof raw !== "object") return null;
	const l = raw as Record<string, unknown>;
	const taxRate = parseTaxRate(l.taxRate ?? l.tax_rate);
	const amountTaxIncl =
		typeof (l.amountTaxIncl ?? l.amount_tax_incl) === "number"
			? (l.amountTaxIncl ?? (l.amount_tax_incl as number))
			: null;
	if (taxRate == null || amountTaxIncl == null) return null;
	return {
		taxRate,
		amountTaxIncl: amountTaxIncl as number,
		accountCategory:
			typeof l.accountCategory === "string"
				? l.accountCategory
				: typeof l.account_category === "string"
					? l.account_category
					: null,
		itemName:
			typeof l.itemName === "string"
				? l.itemName
				: typeof l.item_name === "string"
					? l.item_name
					: null,
	};
}

function parseTaxRate(v: unknown): 0 | 8 | 10 | null {
	const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
	if (n === 0 || n === 8 || n === 10) return n;
	return null;
}

function parseTaxRateCategory(v: unknown): "8" | "10" | "mixed" | null {
	if (v === "8" || v === "10" || v === "mixed") return v;
	return null;
}
