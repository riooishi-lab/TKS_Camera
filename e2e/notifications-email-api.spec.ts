import { expect, test } from "@playwright/test";

// 通知メール送信 Route Handler のスモークテスト。
// 認証不要の API のため、認証モック基盤なしで検証できる。
test.describe("通知メール送信API", () => {
	test("宛先が空の場合は送信されずスキップされる", async ({ request }) => {
		const res = await request.post("/api/notifications/email", {
			data: { to: [], subject: "テスト", text: "テスト本文" },
		});
		expect(res.ok()).toBeTruthy();
		const body = await res.json();
		expect(body.skipped).toBe(true);
	});

	test("未登録アドレス宛は除外され送信されない（踏み台化防止）", async ({
		request,
	}) => {
		const res = await request.post("/api/notifications/email", {
			data: {
				to: [`not-a-user-${Date.now()}@example.com`],
				subject: "テスト",
				text: "テスト本文",
			},
		});
		expect(res.ok()).toBeTruthy();
		const body = await res.json();
		// 登録ユーザー以外の宛先はサーバー側で除外され、結果として宛先0件になる
		expect(body.skipped).toBe(true);
		expect(body.reason).toBe("no recipients");
	});

	// NOTE: レシートの編集ロック・差戻し再申請・承認取り消し・一括承認・
	// 小口現金帳の入金編集・通知ベルの挙動は、いずれも認証配下のため
	// Firebase + Supabase の認証モックが必要。認証 E2E 基盤の整備後に追加する。
	test.skip("認証配下のレシート承認ワークフロー（編集ロック・再申請・一括承認ほか）", () => {});
});
