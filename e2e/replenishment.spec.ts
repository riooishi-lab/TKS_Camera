import { test } from "@playwright/test";

// Phase 5 Step 3: 小口現金補充申請ワークフローの検証スイート。
//
// フロー: 起票(pending) → 承認(approved) → 支給済(fulfilled)
//        ／ 差戻し(rejected)
//
// 認証配下のフローのため、Firebase Auth + Supabase の認証モック基盤が必要。
// 基盤整備後に test.skip を外して有効化する。
test.describe("小口現金 補充申請（Phase 5 Step 3）", () => {
	test.skip("店舗担当者起票 → 経理承認 → 経理支給済 が一連で通る", async () => {
		// REQ-REP-01〜05
		// 1. store_staff としてログイン、/replenishment/new を開く
		// 2. 翌月・金額10万円・理由を入力して申請
		// 3. /replenishment に戻り、当該申請が「申請中」で表示される
		// 4. hq_accountant としてログインし直し、同申請の「承認」を押下
		// 5. ステータス=approved、申請者へ通知が作られる（自己発火しない）
		// 6. 「支給済にする」を押下、支給日と摘要を入力して確定
		// 7. tks_cash_deposits に新規行ができ、fulfilled_deposit_id で紐づく
		// 8. 小口現金帳ページで当該店舗の入金が反映される
	});

	test.skip("差戻し: 経理が差戻し理由付きで rejected にし、申請者へ通知される", async () => {
		// REQ-REP-06, REQ-N-02
		// 1. pending 申請に対し経理が「差戻し」、理由を入力
		// 2. ステータス=rejected、rejectionReason が保存される
		// 3. 申請者と当該店舗の店長へアプリ内通知 + メール
	});

	test.skip("店舗ロールは自店舗の申請のみ閲覧できる", async () => {
		// REQ-REP-01
		// 1. 渋谷店の store_staff としてログイン
		// 2. /replenishment 一覧に渋谷店の申請のみ表示
		// 3. 新宿店の申請は表示されない
	});

	test.skip("社長(president)は新規申請ボタンが表示されない（閲覧専用）", async () => {
		// REQ-R-04
		// 1. president としてログイン、/replenishment を開く
		// 2. 「新規申請」ボタンが非表示
		// 3. 承認/差戻し/支給済のアクションボタンも非表示
	});

	test.skip("同一店舗・同一対象月でも追加申請を起票できる (REQ-REP-03)", async () => {
		// 1. 6月分10万円を申請 → approved にする
		// 2. 同じ店舗で 6月分の追加申請（5万円）を起票
		// 3. 2件目も正常に保存され、一覧に2行表示される
	});

	test.skip("支給済記録は cash_deposits を自動作成し、二重作成しない", async () => {
		// REQ-REP-05
		// 1. approved → 支給済 を1回押下、deposit が1件作成
		// 2. 同じ申請の支給済アクションが消える
		// 3. tks_cash_replenishment_requests.fulfilled_deposit_id が deposit.id
	});

	test.skip("サマリー: 申請中/承認済/翌月補充希望額 が正しく集計される", async () => {
		// T3-5
		// 1. pending 2件、approved 1件、fulfilled 1件 を投入
		// 2. ページ上部のサマリーカードに 申請中=2件、承認済(未支給)=1件、
		//    翌月補充希望額 = 翌月分のpending+approvedの合算 が表示される
	});
});
