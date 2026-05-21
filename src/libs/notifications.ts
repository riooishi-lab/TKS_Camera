import { PAGE_PATH } from "@/constants/pagePath";
import {
	createNotifications,
	getUsers,
	type NotificationType,
	type Receipt,
	type TksUser,
	type UserRole,
} from "./storage";

// 承認ワークフロー上の通知イベント。
// fully_approved = 全承認完了（経理へ支払い依頼）
export type ReceiptNotificationEvent =
	| "submitted"
	| "resubmitted"
	| "manager_approved"
	| "accountant_approved"
	| "fully_approved"
	| "rejected"
	| "paid";

// 承認を1段階進めるための更新パッチと通知イベントをロールから決定する。
// 承認者ロールは承認できるステージが一意に定まるため、ロールのみで遷移先が決まる。
// 呼び出し側で対象レシートが該当ステージにあることを保証すること。
export function buildApprovalPatch(
	role: UserRole | undefined,
	actorId: string | null,
	now: string,
): { patch: Partial<Receipt>; event: ReceiptNotificationEvent } | null {
	switch (role) {
		case "store_manager":
			return {
				patch: {
					status: "manager_approved",
					managerApprovedBy: actorId,
					managerApprovedAt: now,
				},
				event: "manager_approved",
			};
		case "hq_accountant":
			return {
				patch: {
					status: "accountant_approved",
					accountantApprovedBy: actorId,
					accountantApprovedAt: now,
				},
				event: "accountant_approved",
			};
		case "president":
			return {
				patch: {
					status: "approved",
					presidentApprovedBy: actorId,
					presidentApprovedAt: now,
				},
				event: "fully_approved",
			};
		default:
			return null;
	}
}

function receiptLabel(receipt: Receipt): string {
	const payee = receipt.payee ?? "レシート";
	const amount =
		receipt.amount != null ? `（${receipt.amount.toLocaleString()}円）` : "";
	return `${payee}${amount}`;
}

// イベントごとに通知先となるユーザーを決定する
function resolveRecipients(
	event: ReceiptNotificationEvent,
	receipt: Receipt,
	activeUsers: TksUser[],
): TksUser[] {
	switch (event) {
		case "submitted":
		case "resubmitted":
			// 申請先 = 当該店舗の店舗管理者
			return activeUsers.filter(
				(u) =>
					u.role === "store_manager" &&
					receipt.storeId != null &&
					u.storeId === receipt.storeId,
			);
		case "manager_approved":
			// 店長承認後 = 経理へ
			return activeUsers.filter((u) => u.role === "hq_accountant");
		case "accountant_approved":
			// 経理承認後 = 社長へ
			return activeUsers.filter((u) => u.role === "president");
		case "fully_approved":
			// 全承認後 = 経理へ（支払い処理）
			return activeUsers.filter((u) => u.role === "hq_accountant");
		case "rejected":
		case "paid":
			// 差戻し・支払完了 = 申請者本人へ
			return activeUsers.filter((u) => u.id === receipt.createdBy);
	}
}

function buildMessage(
	event: ReceiptNotificationEvent,
	receipt: Receipt,
): { type: NotificationType; title: string; body: string } {
	const label = receiptLabel(receipt);
	switch (event) {
		case "submitted":
			return {
				type: "receipt_submitted",
				title: "新しいレシートが申請されました",
				body: `${label} の承認をお願いします。`,
			};
		case "resubmitted":
			return {
				type: "receipt_resubmitted",
				title: "差戻したレシートが再申請されました",
				body: `${label} が修正のうえ再申請されました。承認をお願いします。`,
			};
		case "manager_approved":
			return {
				type: "receipt_approved",
				title: "店長承認済みのレシートがあります",
				body: `${label} の経理承認をお願いします。`,
			};
		case "accountant_approved":
			return {
				type: "receipt_approved",
				title: "経理承認済みのレシートがあります",
				body: `${label} の社長承認をお願いします。`,
			};
		case "fully_approved":
			return {
				type: "receipt_fully_approved",
				title: "全承認済みのレシートがあります",
				body: `${label} の支払い処理をお願いします。`,
			};
		case "rejected":
			return {
				type: "receipt_rejected",
				title: "レシートが差戻されました",
				body: receipt.rejectionReason
					? `${label} が差戻されました。理由: ${receipt.rejectionReason}`
					: `${label} が差戻されました。内容を修正して再申請してください。`,
			};
		case "paid":
			return {
				type: "receipt_paid",
				title: "レシートが支払済みになりました",
				body: `${label} の精算が完了しました。`,
			};
	}
}

// レシートのステータス変更を関係者に通知する。
// アプリ内通知を作成し、設定済みであればメールも送信する。
// 通知の失敗は呼び出し元の処理を妨げないよう内部で握りつぶす。
// users を渡すと一覧取得を省略する（一括承認など連続呼び出し時の最適化）。
export async function notifyReceiptEvent(params: {
	receipt: Receipt;
	event: ReceiptNotificationEvent;
	users?: TksUser[];
}): Promise<void> {
	try {
		const { receipt, event } = params;
		const users = params.users ?? (await getUsers());
		const activeUsers = users.filter((u) => u.status === "active");
		const recipients = resolveRecipients(event, receipt, activeUsers);
		if (recipients.length === 0) return;

		const { type, title, body } = buildMessage(event, receipt);

		await createNotifications(
			recipients.map((u) => ({
				recipientId: u.id,
				type,
				receiptId: receipt.id,
				title,
				body,
			})),
		);

		const emails = recipients.map((u) => u.email).filter(Boolean);
		if (emails.length === 0) return;

		const url =
			typeof window !== "undefined"
				? `${window.location.origin}${PAGE_PATH.receiptDetail(receipt.id)}`
				: PAGE_PATH.receiptDetail(receipt.id);

		await fetch("/api/notifications/email", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				to: emails,
				subject: `[レシートスキャナー] ${title}`,
				text: `${body}\n\nレシート詳細はこちら:\n${url}`,
			}),
		});
	} catch (err) {
		console.error("notifyReceiptEvent:", err);
	}
}
