import { expect, test } from "@playwright/test";

test.describe("認証フロー スモークテスト", () => {
	test("未認証で保護ルート（/receipts）にアクセスするとサインインフローに誘導される", async ({
		page,
	}) => {
		const response = await page.goto("/receipts", {
			waitUntil: "domcontentloaded",
		});
		expect(response?.ok()).toBeTruthy();
		// プロジェクトの `/login`、または Next.js 16 の組込み `/auth/signin` のいずれか
		await page.waitForURL(/\/(login|auth\/signin)/, { timeout: 15_000 });
	});

	// NOTE: 認証後のサイドバー本体の挙動（折りたたみトグル、RBAC 出し分け、
	// モバイル Sheet ドロワー、aria-current / aria-expanded 属性の切り替え）は、
	// Firebase + Supabase の認証モックが必要なため現時点ではスキップ。
	// 認証 E2E 基盤が整備され次第、ここに追加する。
	test.skip("認証後のサイドバー挙動（折りたたみ・RBAC・モバイルドロワー）", () => {});
});
