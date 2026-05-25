import { expect, test } from "@playwright/test";

// 招待アカウント登録ページのスモークテスト。
// 招待コードなしの無効ケースは認証・DB アクセス不要で検証できる。
test.describe("招待アカウント登録", () => {
	test("招待コードなしでアクセスすると無効な招待リンクと表示される", async ({
		page,
	}) => {
		await page.goto("/register", { waitUntil: "domcontentloaded" });
		await expect(page.getByText("無効な招待リンクです")).toBeVisible({
			timeout: 15_000,
		});
	});

	// NOTE: 本 PR の主対象である「孤立 Firebase Auth アカウントの救済」
	// （createUserWithEmailAndPassword 成功後に updateUser が失敗し、
	// Auth だけ作成され tks_users 行が pending のまま残った状態からの
	// 再登録）は、pending 招待行の投入と孤立 Auth アカウントの作成・
	// 後始末に Supabase + Firebase Admin の E2E 基盤が必要。
	// 認証 E2E 基盤の整備後に追加する。
	test.skip("孤立アカウント救済（入力パスワードでサインインし登録を自己修復）", () => {});
});
