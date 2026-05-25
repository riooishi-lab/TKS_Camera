import { test } from "@playwright/test";

// Phase 5 Step 6: 会計CSV出力(β)の検証スイート。
//
// 仕様:
//   - 経理承認済み(accountant_approved) または 支払済(paid) のレシートのみ
//   - line items 単位で展開（1明細 = CSV 1行）
//   - feature flag NEXT_PUBLIC_ENABLE_ACCOUNTING_CSV=true で UI を有効化
//   - hq_accountant のみアクセス可能
//
// 認証配下のフローのため、Firebase Auth + Supabase の認証モック基盤が必要。
// 基盤整備後に test.skip を外して有効化する。
test.describe("会計CSV出力（Phase 5 Step 6）", () => {
	test.skip("feature flag が false の場合、CSV出力カードが表示されない (REQ-CSV-06)", async () => {
		// 1. NEXT_PUBLIC_ENABLE_ACCOUNTING_CSV=false で起動
		// 2. hq_accountant でレポートページを開く
		// 3. 「会計ソフト向け CSV 出力」カードが見えない
	});

	test.skip("feature flag が true で hq_accountant のみ CSV カードが見える", async () => {
		// 1. NEXT_PUBLIC_ENABLE_ACCOUNTING_CSV=true で起動
		// 2. hq_accountant でレポートを開く → カードが見える
		// 3. store_manager / president / store_staff では見えない
	});

	test.skip("単一税率レシート1件 → CSV 1行に展開", async () => {
		// REQ-CSV-03
		// 1. 10% / 1100円 / 消耗品費 のレシートを accountant_approved 状態で投入
		// 2. CSV ダウンロード → ヘッダ + 1行
		// 3. 列: 日付/店舗名/勘定科目/税込金額(1100)/税率(10%)/インボイス区分/...
	});

	test.skip("税率混在レシート1件 → CSV 2行に展開 (REQ-CSV-03)", async () => {
		// 1. 8%(540) と 10%(1100) の混在レシートを投入
		// 2. CSV ダウンロード → ヘッダ + 2行
		// 3. 各行に税率と勘定科目が分かれて入る
	});

	test.skip("未承認(pending/manager_approved/rejected) は出力対象外 (REQ-CSV-02)", async () => {
		// 1. 各ステータスのレシートを1件ずつ投入
		// 2. CSV ダウンロード → accountant_approved と paid のみ含まれる
	});

	test.skip("月フィルタを指定すると対象月のみ出力", async () => {
		// 1. 5月分と6月分の paid レシートを投入
		// 2. 対象月=2026-05 で出力 → 5月分のみ
		// 3. ファイル名が keihi_202605_all.csv
	});

	test.skip("店舗フィルタを指定すると該当店舗のみ出力", async () => {
		// 1. 渋谷店と新宿店のレシートを投入
		// 2. 店舗=渋谷店 で出力 → 渋谷店のみ
		// 3. ファイル名が keihi_all_渋谷店.csv
	});

	test.skip("インボイス登録なし(invoice_eligible=false) は CSV 上「登録なし（80%控除）」", async () => {
		// REQ-INV-04
		// 1. 親 receipt.invoice_status=registered でも、明細.invoice_eligible=false の行は
		//    CSV のインボイス区分列が「登録なし（80%控除）」になる
	});

	test.skip("店長立替 receipts は CSV の支払区分列が「店長立替（給与振込）」", async () => {
		// 1. expense_type=personal の paid レシートを投入
		// 2. CSV の「支払区分」列が「店長立替（給与振込）」と表示
	});

	test.skip("出力対象0件の場合はアラートで通知し、ファイルダウンロードしない", async () => {
		// 1. 全レシートが pending 状態
		// 2. CSV ダウンロードを押下 → "出力対象のレシートがありません" アラート
		// 3. ファイル生成されない
	});
});
