import { NextResponse } from "next/server";
import { getSupabase } from "@/libs/supabase";

type EmailRequest = {
	to: string[];
	subject: string;
	text: string;
};

// 宛先を登録済みかつ有効なユーザーのメールアドレスのみに絞り込む。
// 任意アドレスへの送信を防ぎ、メール送信エンドポイントの踏み台化を防ぐ。
async function filterToRegisteredUsers(addresses: string[]): Promise<string[]> {
	const { data, error } = await getSupabase()
		.from("tks_users")
		.select("email")
		.eq("status", "active");
	if (error) {
		console.error("notifications/email: ユーザー検証に失敗", error.message);
		return [];
	}
	const allowed = new Set((data ?? []).map((u) => u.email as string));
	return addresses.filter((addr) => allowed.has(addr));
}

// 通知メールを送信する Route Handler。
// RESEND_API_KEY / NOTIFICATION_FROM_EMAIL が未設定の場合は
// エラーにせずスキップし、アプリ内通知のみで運用できるようにする。
export async function POST(request: Request) {
	try {
		const { to, subject, text } = (await request.json()) as EmailRequest;
		const requested = (to ?? []).filter((addr) => !!addr);
		// 登録ユーザー以外の宛先（外部アドレス）は除外する
		const recipients = await filterToRegisteredUsers(requested);
		if (recipients.length === 0) {
			return NextResponse.json({ skipped: true, reason: "no recipients" });
		}

		const apiKey = process.env.RESEND_API_KEY;
		const from = process.env.NOTIFICATION_FROM_EMAIL;
		if (!apiKey || !from) {
			console.warn(
				"notifications/email: RESEND_API_KEY / NOTIFICATION_FROM_EMAIL が未設定のためメール送信をスキップしました",
			);
			return NextResponse.json({ skipped: true, reason: "not configured" });
		}

		// 受信者間でアドレスが見えないよう1通ずつ送信する
		const results = await Promise.allSettled(
			recipients.map((addr) =>
				fetch("https://api.resend.com/emails", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${apiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ from, to: [addr], subject, text }),
				}).then(async (res) => {
					if (!res.ok) {
						throw new Error(`${res.status} ${await res.text()}`);
					}
				}),
			),
		);

		const failed = results.filter((r) => r.status === "rejected");
		if (failed.length > 0) {
			for (const f of failed) {
				if (f.status === "rejected") {
					console.error("notifications/email: Resend送信失敗", f.reason);
				}
			}
			return NextResponse.json(
				{ sent: recipients.length - failed.length, failed: failed.length },
				{ status: 207 },
			);
		}

		return NextResponse.json({ sent: recipients.length });
	} catch (err) {
		console.error("notifications/email:", err);
		return NextResponse.json(
			{ error: "メール送信中にエラーが発生しました" },
			{ status: 500 },
		);
	}
}
