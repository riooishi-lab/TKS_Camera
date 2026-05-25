import { PAGE_PATH } from "@/constants/pagePath";
import {
	type CashReplenishmentRequest,
	createNotifications,
	getUsers,
	type NotificationType,
	type Receipt,
	type TksUser,
	type UserRole,
} from "./storage";

// 承認ワークフロー上の通知イベント。
// Phase 5 から社長承認(fully_approved)を廃止し3段階に簡素化。
// 経理承認後は次が支払処理のため、申請者本人に通知する。
export type ReceiptNotificationEvent =
	| "submitted"
	| "resubmitted"
	| "manager_approved"
	| "accountant_approved"
	| "rejected"
	| "paid";

// 承認を1段階進めるための更新パッチと通知イベントをロールから決定する。
// 承認者ロールは承認できるステージが一意に定まるため、ロールのみで遷移先が決まる。
// 呼び出し側で対象レシートが該当ステージにあることを保証すること。
// president は閲覧専用のため承認パッチを返さない。
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
// REQ-N-04: 自己発火抑止は notifyReceiptEvent 側でフィルタする
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
			// 店長承認後 = 本社経理へ
			return activeUsers.filter((u) => u.role === "hq_accountant");
		case "accountant_approved":
			// 経理承認後 = 支払処理待ちのため申請者本人へ
			// （Phase 5 で社長承認ステージを廃止）
			return activeUsers.filter((u) => u.id === receipt.createdBy);
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
	// Phase 5: 立替経費(personal) は給与同時振込で支給されるため文言を差し替え
	const isPersonal = receipt.expenseType === "personal";
	switch (event) {
		case "submitted":
			return {
				type: "receipt_submitted",
				title: isPersonal
					? "新しい立替経費が申請されました"
					: "新しいレシートが申請されました",
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
				title: isPersonal
					? "立替経費が経理承認されました"
					: "レシートが経理承認されました",
				body: isPersonal
					? `${label} の経理承認が完了しました。給与同時振込で支給予定です。`
					: `${label} の経理承認が完了しました。まもなく支払処理が行われます。`,
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
				title: isPersonal
					? "立替経費が給与振込で支給されました"
					: "レシートが支払済みになりました",
				body: isPersonal
					? `${label} の立替分は給与振込で支給されました。`
					: `${label} の精算が完了しました。`,
			};
	}
}

// レシートのステータス変更を関係者に通知する。
// アプリ内通知を作成し、設定済みであればメールも送信する。
// 通知の失敗は呼び出し元の処理を妨げないよう内部で握りつぶす。
// users を渡すと一覧取得を省略する（一括承認など連続呼び出し時の最適化）。
// REQ-N-04: actor と同一の受信者は除外する（自己発火抑止）。
export async function notifyReceiptEvent(params: {
	receipt: Receipt;
	event: ReceiptNotificationEvent;
	users?: TksUser[];
	actorId?: string | null;
}): Promise<void> {
	try {
		const { receipt, event, actorId } = params;
		const users = params.users ?? (await getUsers());
		const activeUsers = users.filter((u) => u.status === "active");
		const recipients = resolveRecipients(event, receipt, activeUsers).filter(
			(u) => !actorId || u.id !== actorId,
		);
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

// ===== 補充申請の通知 (Phase 5) =====

export type ReplenishmentNotificationEvent =
	| "submitted"
	| "approved"
	| "rejected"
	| "fulfilled";

function replenishmentLabel(r: CashReplenishmentRequest): string {
	const [y, m] = r.targetMonth.split("-");
	const ym = `${y}年${Number(m)}月`;
	return `${ym}分 ${r.requestedAmount.toLocaleString()}円`;
}

function resolveReplenishmentRecipients(
	event: ReplenishmentNotificationEvent,
	request: CashReplenishmentRequest,
	activeUsers: TksUser[],
): TksUser[] {
	switch (event) {
		case "submitted":
			// 起票 → 本社経理へ
			return activeUsers.filter((u) => u.role === "hq_accountant");
		case "approved":
		case "rejected":
		case "fulfilled":
			// 承認/差戻し/支給 → 申請者本人＋自店舗の店長へ
			return activeUsers.filter(
				(u) =>
					u.id === request.requestedBy ||
					(u.role === "store_manager" && u.storeId === request.storeId),
			);
	}
}

function buildReplenishmentMessage(
	event: ReplenishmentNotificationEvent,
	request: CashReplenishmentRequest,
): { type: NotificationType; title: string; body: string } {
	const label = replenishmentLabel(request);
	switch (event) {
		case "submitted":
			return {
				type: "replenishment_submitted",
				title: "小口現金 補充申請があります",
				body: `${label} の補充申請を確認してください。`,
			};
		case "approved":
			return {
				type: "replenishment_approved",
				title: "補充申請が承認されました",
				body: `${label} の補充申請が承認されました。`,
			};
		case "rejected":
			return {
				type: "replenishment_rejected",
				title: "補充申請が差戻されました",
				body: request.rejectionReason
					? `${label} が差戻されました。理由: ${request.rejectionReason}`
					: `${label} の補充申請が差戻されました。`,
			};
		case "fulfilled":
			return {
				type: "replenishment_fulfilled",
				title: "現金が支給されました",
				body: `${label} の現金支給を記録しました。`,
			};
	}
}

export async function notifyReplenishmentEvent(params: {
	request: CashReplenishmentRequest;
	event: ReplenishmentNotificationEvent;
	users?: TksUser[];
	actorId?: string | null;
}): Promise<void> {
	try {
		const { request, event, actorId } = params;
		const users = params.users ?? (await getUsers());
		const activeUsers = users.filter((u) => u.status === "active");
		const recipients = resolveReplenishmentRecipients(
			event,
			request,
			activeUsers,
		).filter((u) => !actorId || u.id !== actorId);
		if (recipients.length === 0) return;

		const { type, title, body } = buildReplenishmentMessage(event, request);
		await createNotifications(
			recipients.map((u) => ({
				recipientId: u.id,
				type,
				receiptId: null,
				title,
				body,
			})),
		);

		const emails = recipients.map((u) => u.email).filter(Boolean);
		if (emails.length === 0) return;
		const url =
			typeof window !== "undefined"
				? `${window.location.origin}${PAGE_PATH.replenishment}`
				: PAGE_PATH.replenishment;
		await fetch("/api/notifications/email", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				to: emails,
				subject: `[レシートスキャナー] ${title}`,
				text: `${body}\n\n補充申請一覧:\n${url}`,
			}),
		});
	} catch (err) {
		console.error("notifyReplenishmentEvent:", err);
	}
}
