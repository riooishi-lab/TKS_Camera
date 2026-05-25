import { test } from "@playwright/test";

// Phase 5: 3段階承認フロー（店長 → 経理 → 支払）の検証スイート。
//
// 旧フロー: pending → manager_approved → accountant_approved → approved → paid
// 新フロー: pending → manager_approved → accountant_approved → paid
// （社長承認ステージ廃止、社長は閲覧専用）
//
// 認証配下のフローのため、Firebase Auth + Supabase の認証モック基盤が必要。
// 基盤整備後に test.skip を外して有効化する。
test.describe("3段階承認フロー（Phase 5）", () => {
	test.skip("店舗担当者(store_staff)起票 → 店長承認 → 経理承認 → 支払 が4段階アクションで通る", async () => {
		// 1. store_staff としてログイン、レシート起票（status=pending）
		// 2. store_manager としてログイン、自店舗のレシートを承認 → manager_approved
		// 3. hq_accountant としてログイン、承認 → accountant_approved
		// 4. hq_accountant が「支払済にする」→ paid
		// 5. 各遷移で audit_logs と notifications が記録されることを確認
	});

	test.skip("店長(store_manager)が起票したレシートは自動承認で manager_approved になる", async () => {
		// REQ-A-02 / US-2.2
		// 1. store_manager としてログイン、レシート起票
		// 2. 一覧/詳細画面でステータスが manager_approved になっていること
		// 3. manager_approved_by が起票した店長の id であること
		// 4. 経理(hq_accountant)に manager_approved 通知が届くこと（自己発火しない）
	});

	test.skip("社長(president)は承認/差戻し/支払ボタンが表示されない（閲覧専用）", async () => {
		// REQ-R-04
		// 1. president としてログイン
		// 2. レシート詳細画面を開く（status=manager_approved / accountant_approved いずれも）
		// 3. 承認・差戻し・支払・取り消しボタンが非表示
		// 4. 一括承認ボタンも非表示
	});

	test.skip("差戻し(rejected)→ 再申請で status=pending に戻り、承認情報がクリアされる", async () => {
		// REQ-A-04, REQ-A-05
		// 1. hq_accountant が manager_approved 状態のレシートを差戻し
		// 2. 起票者(store_staff)が再申請
		// 3. status=pending、manager_approved_by/at と accountant_approved_by/at がクリア
		// 4. submitted_at が再申請時刻に更新される（Step 2 で submitted_at 列追加後）
	});

	test.skip("accountant_approved 状態のレシートは、ステータス絞り込み一覧で「経理承認済」として表示される", async () => {
		// Phase 5 で「全承認済(approved)」ラベルを廃止、accountant_approved が最終承認扱い
		// 1. 一覧画面のステータス絞り込みプルダウンに「全承認済」が無いこと
		// 2. accountant_approved のバッジバリアントが "default"（旧 approved と同色）
	});

	test.skip("承認の取り消し(revert)が3段階フローで正しく1段階前に戻る", async () => {
		// 1. paid → accountant_approved（経理が取り消し、社長ステージは経由しない）
		// 2. accountant_approved → manager_approved（経理が取り消し）
		// 3. manager_approved → pending（店長が取り消し）
		// 各遷移で当該ステージの承認情報がクリアされること
	});

	test.skip("hq_accountant の一括承認は manager_approved 状態のレシートを accountant_approved に進める", async () => {
		// Phase 5: 旧 president の accountant_approved → approved 一括承認は廃止
		// 1. manager_approved のレシートを複数チェック
		// 2. 一括承認 → 全件 accountant_approved になる
		// 3. 申請者全員に accountant_approved 通知が届く
	});
});

// 通知の自己発火抑止のスモークテスト（認証不要部分）。
// REQ-N-04: 状態変更を行った actor 自身には通知が作られないこと。
test.describe("通知の自己発火抑止", () => {
	test.skip("店長自身が起票で manager_approved を付与した場合、その店長には通知が作られない", async () => {
		// REQ-N-04
		// 1. store_manager がレシート起票（自動承認）
		// 2. tks_notifications テーブルに当該レシートで recipient_id = 起票店長 の行が無い
		// 3. 経理(hq_accountant) には manager_approved 通知が作られている
	});
});
