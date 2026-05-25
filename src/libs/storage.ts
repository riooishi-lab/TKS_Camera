import { getSupabase } from "./supabase";

// ===== Types =====

export type UserRole =
	| "store_staff"
	| "store_manager"
	| "hq_accountant"
	| "president";
export type UserStatus = "pending" | "active";

export type Store = {
	id: string;
	name: string;
	createdAt: string;
};

export type TksUser = {
	id: string;
	firebaseUid: string | null;
	email: string;
	name: string | null;
	role: UserRole;
	status: UserStatus;
	storeId: string | null;
	inviteCode: string | null;
	invitedBy: string | null;
	createdAt: string;
};

export type ReceiptStatus =
	| "pending"
	| "manager_approved"
	| "accountant_approved"
	| "paid"
	| "rejected";

export type ExpenseType = "petty_cash" | "personal";
export type InvoiceStatus = "registered" | "unregistered" | "unknown";

export type Receipt = {
	id: string;
	storeId: string | null;
	status: ReceiptStatus;
	date: string | null;
	payee: string | null;
	amount: number | null;
	taxAmount: number | null;
	taxRateCategory: "8" | "10" | "mixed" | null;
	accountCategory: string | null;
	description: string | null;
	invoiceRegistrationNo: string | null;
	purpose: string | null;
	participants: string | null;
	imageUrl: string;
	aiRawResponse: Record<string, unknown> | null;
	aiConfidence: number | null;
	isAiVerified: boolean;
	managerApprovedBy: string | null;
	managerApprovedAt: string | null;
	accountantApprovedBy: string | null;
	accountantApprovedAt: string | null;
	presidentApprovedBy: string | null;
	presidentApprovedAt: string | null;
	rejectionReason: string | null;
	paidBy: string | null;
	paidAt: string | null;
	createdBy: string | null;
	updatedBy: string | null;
	createdAt: string;
	updatedAt: string;
	// Phase 5
	submittedAt: string | null;
	expenseType: ExpenseType;
	invoiceStatus: InvoiceStatus;
	itemName: string | null;
	imageMetadata: Record<string, unknown> | null;
};

// Phase 5: レシート明細（税率混在・複数勘定科目に対応）
export type ReceiptLine = {
	id: string;
	receiptId: string;
	lineNo: number;
	taxRate: 0 | 8 | 10;
	amountTaxIncl: number;
	accountCategory: string;
	itemName: string | null;
	invoiceEligible: boolean;
	createdAt: string;
};

export type ReceiptLineInput = {
	lineNo: number;
	taxRate: 0 | 8 | 10;
	amountTaxIncl: number;
	accountCategory: string;
	itemName: string | null;
	invoiceEligible: boolean;
};

export type CashDeposit = {
	id: string;
	storeId: string;
	date: string;
	amount: number;
	description: string | null;
	createdBy: string | null;
	createdAt: string;
};

export type Tag = {
	id: string;
	name: string;
	color: string | null;
	createdAt: string;
};

export type AuditAction = "create" | "update" | "delete";

export type AuditLog = {
	id: string;
	entityType: string;
	entityId: string;
	action: AuditAction;
	changedBy: string | null;
	changedAt: string;
	diff: Record<string, unknown> | null;
};

export type NotificationType =
	| "receipt_submitted"
	| "receipt_resubmitted"
	| "receipt_approved"
	| "receipt_fully_approved"
	| "receipt_rejected"
	| "receipt_paid"
	// Phase 5: 補充申請
	| "replenishment_submitted"
	| "replenishment_approved"
	| "replenishment_rejected"
	| "replenishment_fulfilled";

export type AppNotification = {
	id: string;
	recipientId: string;
	type: NotificationType;
	receiptId: string | null;
	title: string;
	body: string | null;
	isRead: boolean;
	createdAt: string;
};

// ===== Stores =====

export async function getStores(): Promise<Store[]> {
	const { data, error } = await getSupabase()
		.from("tks_stores")
		.select("*")
		.order("name", { ascending: true });
	if (error) console.error("getStores:", error.message);
	return (data ?? []).map(mapStore);
}

export async function saveStore(name: string): Promise<Store> {
	const { data, error } = await getSupabase()
		.from("tks_stores")
		.insert({ name })
		.select()
		.single();
	if (error) throw new Error(error.message);
	return mapStore(data);
}

export async function updateStore(
	id: string,
	input: { name: string },
): Promise<Store | null> {
	const { data } = await getSupabase()
		.from("tks_stores")
		.update(input)
		.eq("id", id)
		.select()
		.single();
	return data ? mapStore(data) : null;
}

export async function deleteStore(id: string): Promise<boolean> {
	const { error } = await getSupabase()
		.from("tks_stores")
		.delete()
		.eq("id", id);
	return !error;
}

function mapStore(s: Record<string, unknown>): Store {
	return {
		id: s.id as string,
		name: s.name as string,
		createdAt: s.created_at as string,
	};
}

// ===== Receipts =====

// 内容編集を許可するステータス。
// manager_approved 以降は承認後の改ざんを防ぐため編集ロックする。
// rejected は差戻し後の修正・再申請のため編集可能とする。
export const EDITABLE_RECEIPT_STATUSES: ReceiptStatus[] = [
	"pending",
	"rejected",
];

export function isReceiptEditable(status: ReceiptStatus): boolean {
	return EDITABLE_RECEIPT_STATUSES.includes(status);
}

export async function getReceipts(): Promise<Receipt[]> {
	const { data, error } = await getSupabase()
		.from("tks_receipts")
		.select("*")
		.order("created_at", { ascending: false });
	if (error) console.error("getReceipts:", error.message);
	return (data ?? []).map(mapReceipt);
}

export async function getReceipt(id: string): Promise<Receipt | null> {
	const { data, error } = await getSupabase()
		.from("tks_receipts")
		.select("*")
		.eq("id", id)
		.single();
	if (error) console.error("getReceipt:", error.message);
	return data ? mapReceipt(data) : null;
}

// 店長(store_manager)が起票したレシートは pending を経ずに manager_approved で
// 作成されるため、起票と同時に承認情報を埋められるよう
// managerApprovedBy / managerApprovedAt は input から省かない。
export async function saveReceipt(
	input: Omit<
		Receipt,
		| "id"
		| "createdAt"
		| "updatedAt"
		| "createdBy"
		| "updatedBy"
		| "accountantApprovedBy"
		| "accountantApprovedAt"
		| "presidentApprovedBy"
		| "presidentApprovedAt"
		| "rejectionReason"
		| "paidBy"
		| "paidAt"
	>,
	actorUserId?: string | null,
): Promise<Receipt> {
	const { data, error } = await getSupabase()
		.from("tks_receipts")
		.insert({
			store_id: input.storeId,
			status: input.status,
			date: input.date,
			payee: input.payee,
			amount: input.amount,
			tax_amount: input.taxAmount,
			tax_rate_category: input.taxRateCategory,
			account_category: input.accountCategory,
			description: input.description,
			invoice_registration_no: input.invoiceRegistrationNo,
			purpose: input.purpose,
			participants: input.participants,
			image_url: input.imageUrl,
			ai_raw_response: input.aiRawResponse,
			ai_confidence: input.aiConfidence,
			is_ai_verified: input.isAiVerified,
			manager_approved_by: input.managerApprovedBy,
			manager_approved_at: input.managerApprovedAt,
			submitted_at: input.submittedAt,
			expense_type: input.expenseType,
			invoice_status: input.invoiceStatus,
			item_name: input.itemName,
			image_metadata: input.imageMetadata,
			created_by: actorUserId ?? null,
			updated_by: actorUserId ?? null,
		})
		.select()
		.single();
	if (error) throw new Error(error.message);
	const mapped = mapReceipt(data);
	await writeAuditLog("receipt", mapped.id, "create", actorUserId, {
		after: stripReceiptForAudit(mapped),
	});
	return mapped;
}

export async function updateReceipt(
	id: string,
	input: Partial<Omit<Receipt, "id" | "createdAt">>,
	actorUserId?: string | null,
	// 楽観ロック: 指定時は現在ステータスが一致する場合のみ更新する。
	// 一覧での一括承認など、取得後に他者が状態を変えたレシートの上書きを防ぐ。
	expectedStatus?: ReceiptStatus,
): Promise<Receipt | null> {
	const before = await getReceipt(id);
	const row: Record<string, unknown> = {
		updated_at: new Date().toISOString(),
		updated_by: actorUserId ?? null,
	};
	if (input.storeId !== undefined) row.store_id = input.storeId;
	if (input.status !== undefined) row.status = input.status;
	if (input.date !== undefined) row.date = input.date;
	if (input.payee !== undefined) row.payee = input.payee;
	if (input.amount !== undefined) row.amount = input.amount;
	if (input.taxAmount !== undefined) row.tax_amount = input.taxAmount;
	if (input.taxRateCategory !== undefined)
		row.tax_rate_category = input.taxRateCategory;
	if (input.accountCategory !== undefined)
		row.account_category = input.accountCategory;
	if (input.description !== undefined) row.description = input.description;
	if (input.invoiceRegistrationNo !== undefined)
		row.invoice_registration_no = input.invoiceRegistrationNo;
	if (input.purpose !== undefined) row.purpose = input.purpose;
	if (input.participants !== undefined) row.participants = input.participants;
	if (input.isAiVerified !== undefined) row.is_ai_verified = input.isAiVerified;
	if (input.managerApprovedBy !== undefined)
		row.manager_approved_by = input.managerApprovedBy;
	if (input.managerApprovedAt !== undefined)
		row.manager_approved_at = input.managerApprovedAt;
	if (input.accountantApprovedBy !== undefined)
		row.accountant_approved_by = input.accountantApprovedBy;
	if (input.accountantApprovedAt !== undefined)
		row.accountant_approved_at = input.accountantApprovedAt;
	if (input.presidentApprovedBy !== undefined)
		row.president_approved_by = input.presidentApprovedBy;
	if (input.presidentApprovedAt !== undefined)
		row.president_approved_at = input.presidentApprovedAt;
	if (input.rejectionReason !== undefined)
		row.rejection_reason = input.rejectionReason;
	if (input.paidBy !== undefined) row.paid_by = input.paidBy;
	if (input.paidAt !== undefined) row.paid_at = input.paidAt;
	if (input.submittedAt !== undefined) row.submitted_at = input.submittedAt;
	if (input.expenseType !== undefined) row.expense_type = input.expenseType;
	if (input.invoiceStatus !== undefined)
		row.invoice_status = input.invoiceStatus;
	if (input.itemName !== undefined) row.item_name = input.itemName;
	if (input.imageMetadata !== undefined)
		row.image_metadata = input.imageMetadata;

	let query = getSupabase().from("tks_receipts").update(row).eq("id", id);
	if (expectedStatus !== undefined) {
		query = query.eq("status", expectedStatus);
	}
	const { data } = await query.select().maybeSingle();
	// 該当行なし = レコード不在、または expectedStatus 不一致（他者が更新済み）
	if (!data) return null;
	const after = mapReceipt(data);
	const diff = buildReceiptDiff(before, after);
	if (Object.keys(diff).length > 0) {
		await writeAuditLog("receipt", id, "update", actorUserId, { diff });
	}
	return after;
}

export async function deleteReceipt(
	id: string,
	actorUserId?: string | null,
): Promise<boolean> {
	const before = await getReceipt(id);
	const { error } = await getSupabase()
		.from("tks_receipts")
		.delete()
		.eq("id", id);
	if (error) return false;
	await writeAuditLog("receipt", id, "delete", actorUserId, {
		before: before ? stripReceiptForAudit(before) : null,
	});
	return true;
}

export async function findDuplicateReceipts(params: {
	date: string | null;
	payee: string | null;
	amount: number | null;
	excludeId?: string;
}): Promise<Receipt[]> {
	if (!params.date || !params.payee || params.amount == null) return [];
	let q = getSupabase()
		.from("tks_receipts")
		.select("*")
		.eq("date", params.date)
		.eq("payee", params.payee)
		.eq("amount", params.amount);
	if (params.excludeId) q = q.neq("id", params.excludeId);
	const { data, error } = await q;
	if (error) {
		console.error("findDuplicateReceipts:", error.message);
		return [];
	}
	return (data ?? []).map(mapReceipt);
}

function mapReceipt(r: Record<string, unknown>): Receipt {
	return {
		id: r.id as string,
		storeId: (r.store_id as string | null) ?? null,
		status: r.status as ReceiptStatus,
		date: r.date as string | null,
		payee: r.payee as string | null,
		amount: r.amount as number | null,
		taxAmount: r.tax_amount as number | null,
		taxRateCategory: r.tax_rate_category as "8" | "10" | "mixed" | null,
		accountCategory: r.account_category as string | null,
		description: r.description as string | null,
		invoiceRegistrationNo: r.invoice_registration_no as string | null,
		purpose: r.purpose as string | null,
		participants: r.participants as string | null,
		imageUrl: r.image_url as string,
		aiRawResponse: r.ai_raw_response as Record<string, unknown> | null,
		aiConfidence: r.ai_confidence as number | null,
		isAiVerified: r.is_ai_verified as boolean,
		managerApprovedBy: (r.manager_approved_by as string | null) ?? null,
		managerApprovedAt: (r.manager_approved_at as string | null) ?? null,
		accountantApprovedBy: (r.accountant_approved_by as string | null) ?? null,
		accountantApprovedAt: (r.accountant_approved_at as string | null) ?? null,
		presidentApprovedBy: (r.president_approved_by as string | null) ?? null,
		presidentApprovedAt: (r.president_approved_at as string | null) ?? null,
		rejectionReason: (r.rejection_reason as string | null) ?? null,
		paidBy: (r.paid_by as string | null) ?? null,
		paidAt: (r.paid_at as string | null) ?? null,
		createdBy: (r.created_by as string | null) ?? null,
		updatedBy: (r.updated_by as string | null) ?? null,
		createdAt: r.created_at as string,
		updatedAt: r.updated_at as string,
		submittedAt: (r.submitted_at as string | null) ?? null,
		expenseType: (r.expense_type as ExpenseType) ?? "petty_cash",
		invoiceStatus: (r.invoice_status as InvoiceStatus) ?? "unknown",
		itemName: (r.item_name as string | null) ?? null,
		imageMetadata: (r.image_metadata as Record<string, unknown> | null) ?? null,
	};
}

const AUDITED_RECEIPT_FIELDS: (keyof Receipt)[] = [
	"storeId",
	"status",
	"date",
	"payee",
	"amount",
	"taxAmount",
	"taxRateCategory",
	"accountCategory",
	"description",
	"invoiceRegistrationNo",
	"purpose",
	"participants",
	"isAiVerified",
	"managerApprovedBy",
	"managerApprovedAt",
	"accountantApprovedBy",
	"accountantApprovedAt",
	"presidentApprovedBy",
	"presidentApprovedAt",
	"rejectionReason",
	"paidBy",
	"paidAt",
	"submittedAt",
	"expenseType",
	"invoiceStatus",
	"itemName",
];

function stripReceiptForAudit(r: Receipt): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const k of AUDITED_RECEIPT_FIELDS) out[k] = r[k];
	return out;
}

function buildReceiptDiff(
	before: Receipt | null,
	after: Receipt,
): Record<string, { from: unknown; to: unknown }> {
	const diff: Record<string, { from: unknown; to: unknown }> = {};
	if (!before) return diff;
	for (const k of AUDITED_RECEIPT_FIELDS) {
		if (before[k] !== after[k]) {
			diff[k] = { from: before[k], to: after[k] };
		}
	}
	return diff;
}

// ===== Receipt Lines (Phase 5) =====

export async function getReceiptLines(
	receiptId: string,
): Promise<ReceiptLine[]> {
	const { data, error } = await getSupabase()
		.from("tks_receipt_lines")
		.select("*")
		.eq("receipt_id", receiptId)
		.order("line_no", { ascending: true });
	if (error) console.error("getReceiptLines:", error.message);
	return (data ?? []).map(mapReceiptLine);
}

// 親レシートの明細を全て置き換える。
// lines が変わると receipts 側の amount/taxAmount/taxRateCategory も
// 再計算して保存するため、呼び出し側は集計値の整合性を意識しなくてよい。
// REQ-RC-04: 明細変更時の親集計再計算。
export async function replaceReceiptLines(
	receiptId: string,
	lines: ReceiptLineInput[],
	actorUserId?: string | null,
): Promise<ReceiptLine[]> {
	const supabase = getSupabase();
	const { error: delError } = await supabase
		.from("tks_receipt_lines")
		.delete()
		.eq("receipt_id", receiptId);
	if (delError) throw new Error(delError.message);
	if (lines.length === 0) {
		throw new Error("replaceReceiptLines: 明細は1件以上必要です (REQ-RC-01)");
	}
	const { data, error } = await supabase
		.from("tks_receipt_lines")
		.insert(
			lines.map((l) => ({
				receipt_id: receiptId,
				line_no: l.lineNo,
				tax_rate: l.taxRate,
				amount_tax_incl: l.amountTaxIncl,
				account_category: l.accountCategory,
				item_name: l.itemName,
				invoice_eligible: l.invoiceEligible,
			})),
		)
		.select();
	if (error) throw new Error(error.message);
	const mapped = (data ?? []).map(mapReceiptLine);
	// 親 receipt の集計値を再計算して反映する
	const { aggregateLines } = await import("./receipt-aggregation");
	const agg = aggregateLines(
		mapped.map((l) => ({ taxRate: l.taxRate, amountTaxIncl: l.amountTaxIncl })),
	);
	await updateReceipt(
		receiptId,
		{
			amount: agg.amount,
			taxAmount: agg.taxAmount,
			taxRateCategory: agg.taxRateCategory,
		},
		actorUserId,
	);
	return mapped;
}

function mapReceiptLine(r: Record<string, unknown>): ReceiptLine {
	return {
		id: r.id as string,
		receiptId: r.receipt_id as string,
		lineNo: r.line_no as number,
		taxRate: r.tax_rate as 0 | 8 | 10,
		amountTaxIncl: r.amount_tax_incl as number,
		accountCategory: r.account_category as string,
		itemName: (r.item_name as string | null) ?? null,
		invoiceEligible: r.invoice_eligible as boolean,
		createdAt: r.created_at as string,
	};
}

// ===== Users =====

export async function getUserByFirebaseUid(
	uid: string,
): Promise<TksUser | null> {
	const { data, error } = await getSupabase()
		.from("tks_users")
		.select("*")
		.eq("firebase_uid", uid)
		.single();
	if (error && error.code !== "PGRST116")
		console.error("getUserByFirebaseUid:", error.message);
	return data ? mapUser(data) : null;
}

export async function getUserByInviteCode(
	code: string,
): Promise<TksUser | null> {
	const { data, error } = await getSupabase()
		.from("tks_users")
		.select("*")
		.eq("invite_code", code)
		.eq("status", "pending")
		.single();
	if (error && error.code !== "PGRST116")
		console.error("getUserByInviteCode:", error.message);
	return data ? mapUser(data) : null;
}

export async function getUsers(): Promise<TksUser[]> {
	const { data, error } = await getSupabase()
		.from("tks_users")
		.select("*")
		.order("created_at", { ascending: false });
	if (error) console.error("getUsers:", error.message);
	return (data ?? []).map(mapUser);
}

export async function createUser(input: {
	email: string;
	role: UserRole;
	storeId: string | null;
	inviteCode: string;
	invitedBy: string | null;
}): Promise<TksUser> {
	const { data, error } = await getSupabase()
		.from("tks_users")
		.insert({
			email: input.email,
			role: input.role,
			store_id: input.storeId,
			invite_code: input.inviteCode,
			invited_by: input.invitedBy,
			status: "pending",
		})
		.select()
		.single();
	if (error) throw new Error(error.message);
	return mapUser(data);
}

export async function updateUser(
	id: string,
	input: Partial<{
		firebaseUid: string;
		email: string;
		name: string;
		role: UserRole;
		status: UserStatus;
		storeId: string | null;
	}>,
): Promise<TksUser | null> {
	const row: Record<string, unknown> = {};
	if (input.firebaseUid !== undefined) row.firebase_uid = input.firebaseUid;
	if (input.email !== undefined) row.email = input.email;
	if (input.name !== undefined) row.name = input.name;
	if (input.role !== undefined) row.role = input.role;
	if (input.status !== undefined) row.status = input.status;
	if (input.storeId !== undefined) row.store_id = input.storeId;

	const { data, error } = await getSupabase()
		.from("tks_users")
		.update(row)
		.eq("id", id)
		.select()
		.single();
	if (error) throw new Error(error.message);
	return data ? mapUser(data) : null;
}

export async function deleteUser(id: string): Promise<boolean> {
	const { error } = await getSupabase().from("tks_users").delete().eq("id", id);
	return !error;
}

function mapUser(u: Record<string, unknown>): TksUser {
	return {
		id: u.id as string,
		firebaseUid: u.firebase_uid as string | null,
		email: u.email as string,
		name: u.name as string | null,
		role: u.role as UserRole,
		status: u.status as UserStatus,
		storeId: (u.store_id as string | null) ?? null,
		inviteCode: u.invite_code as string | null,
		invitedBy: u.invited_by as string | null,
		createdAt: u.created_at as string,
	};
}

// ===== Tags =====

export async function getTags(): Promise<Tag[]> {
	const { data, error } = await getSupabase()
		.from("tks_tags")
		.select("*")
		.order("name", { ascending: true });
	if (error) console.error("getTags:", error.message);
	return (data ?? []).map(mapTag);
}

export async function saveTag(
	name: string,
	color: string | null = null,
): Promise<Tag> {
	const { data, error } = await getSupabase()
		.from("tks_tags")
		.insert({ name, color })
		.select()
		.single();
	if (error) throw new Error(error.message);
	return mapTag(data);
}

export async function updateTag(
	id: string,
	input: Partial<{ name: string; color: string | null }>,
): Promise<Tag | null> {
	const { data } = await getSupabase()
		.from("tks_tags")
		.update(input)
		.eq("id", id)
		.select()
		.single();
	return data ? mapTag(data) : null;
}

export async function deleteTag(id: string): Promise<boolean> {
	const { error } = await getSupabase().from("tks_tags").delete().eq("id", id);
	return !error;
}

function mapTag(t: Record<string, unknown>): Tag {
	return {
		id: t.id as string,
		name: t.name as string,
		color: (t.color as string | null) ?? null,
		createdAt: t.created_at as string,
	};
}

// ===== Receipt <-> Tag =====

export async function getReceiptTags(): Promise<Map<string, string[]>> {
	const { data, error } = await getSupabase()
		.from("tks_receipt_tags")
		.select("receipt_id, tag_id");
	if (error) {
		console.error("getReceiptTags:", error.message);
		return new Map();
	}
	const map = new Map<string, string[]>();
	for (const row of data ?? []) {
		const rid = row.receipt_id as string;
		const tid = row.tag_id as string;
		const list = map.get(rid) ?? [];
		list.push(tid);
		map.set(rid, list);
	}
	return map;
}

export async function getTagsForReceipt(receiptId: string): Promise<string[]> {
	const { data, error } = await getSupabase()
		.from("tks_receipt_tags")
		.select("tag_id")
		.eq("receipt_id", receiptId);
	if (error) {
		console.error("getTagsForReceipt:", error.message);
		return [];
	}
	return (data ?? []).map((r) => r.tag_id as string);
}

export async function setReceiptTags(
	receiptId: string,
	tagIds: string[],
	actorUserId?: string | null,
): Promise<void> {
	const before = await getTagsForReceipt(receiptId);
	const beforeSet = new Set(before);
	const afterSet = new Set(tagIds);
	const toAdd = tagIds.filter((t) => !beforeSet.has(t));
	const toRemove = before.filter((t) => !afterSet.has(t));

	if (toRemove.length > 0) {
		await getSupabase()
			.from("tks_receipt_tags")
			.delete()
			.eq("receipt_id", receiptId)
			.in("tag_id", toRemove);
	}
	if (toAdd.length > 0) {
		await getSupabase()
			.from("tks_receipt_tags")
			.insert(toAdd.map((tag_id) => ({ receipt_id: receiptId, tag_id })));
	}
	if (toAdd.length > 0 || toRemove.length > 0) {
		await writeAuditLog("receipt", receiptId, "update", actorUserId, {
			diff: { tags: { from: before, to: tagIds } },
		});
	}
}

// ===== Audit Log =====

async function writeAuditLog(
	entityType: string,
	entityId: string,
	action: AuditAction,
	actorUserId: string | null | undefined,
	diff: Record<string, unknown>,
): Promise<void> {
	const { error } = await getSupabase()
		.from("tks_audit_logs")
		.insert({
			entity_type: entityType,
			entity_id: entityId,
			action,
			changed_by: actorUserId ?? null,
			diff,
		});
	if (error) console.error("writeAuditLog:", error.message);
}

export async function getAuditLogs(
	entityType: string,
	entityId: string,
): Promise<AuditLog[]> {
	const { data, error } = await getSupabase()
		.from("tks_audit_logs")
		.select("*")
		.eq("entity_type", entityType)
		.eq("entity_id", entityId)
		.order("changed_at", { ascending: false });
	if (error) console.error("getAuditLogs:", error.message);
	return (data ?? []).map(mapAuditLog);
}

function mapAuditLog(l: Record<string, unknown>): AuditLog {
	return {
		id: l.id as string,
		entityType: l.entity_type as string,
		entityId: l.entity_id as string,
		action: l.action as AuditAction,
		changedBy: (l.changed_by as string | null) ?? null,
		changedAt: l.changed_at as string,
		diff: (l.diff as Record<string, unknown> | null) ?? null,
	};
}

// ===== Cash Deposits (補充金 / 前月繰越金) =====

export async function getCashDeposits(): Promise<CashDeposit[]> {
	const { data, error } = await getSupabase()
		.from("tks_cash_deposits")
		.select("*")
		.order("date", { ascending: false });
	if (error) console.error("getCashDeposits:", error.message);
	return (data ?? []).map(mapCashDeposit);
}

async function getCashDeposit(id: string): Promise<CashDeposit | null> {
	const { data } = await getSupabase()
		.from("tks_cash_deposits")
		.select("*")
		.eq("id", id)
		.maybeSingle();
	return data ? mapCashDeposit(data) : null;
}

// 入金記録は現金残高に直結するため、レシート同様すべての変更を監査ログに残す
function stripDepositForAudit(d: CashDeposit): Record<string, unknown> {
	return { date: d.date, amount: d.amount, description: d.description };
}

export async function saveCashDeposit(input: {
	storeId: string;
	date: string;
	amount: number;
	description: string | null;
	createdBy: string | null;
}): Promise<CashDeposit> {
	const { data, error } = await getSupabase()
		.from("tks_cash_deposits")
		.insert({
			store_id: input.storeId,
			date: input.date,
			amount: input.amount,
			description: input.description,
			created_by: input.createdBy,
		})
		.select()
		.single();
	if (error) throw new Error(error.message);
	const mapped = mapCashDeposit(data);
	await writeAuditLog("cash_deposit", mapped.id, "create", input.createdBy, {
		after: stripDepositForAudit(mapped),
	});
	return mapped;
}

export async function updateCashDeposit(
	id: string,
	input: Partial<{
		date: string;
		amount: number;
		description: string | null;
	}>,
	actorUserId?: string | null,
): Promise<CashDeposit | null> {
	const before = await getCashDeposit(id);
	const row: Record<string, unknown> = {};
	if (input.date !== undefined) row.date = input.date;
	if (input.amount !== undefined) row.amount = input.amount;
	if (input.description !== undefined) row.description = input.description;
	const { data } = await getSupabase()
		.from("tks_cash_deposits")
		.update(row)
		.eq("id", id)
		.select()
		.maybeSingle();
	if (!data) return null;
	const after = mapCashDeposit(data);
	if (before) {
		const diff: Record<string, { from: unknown; to: unknown }> = {};
		for (const k of ["date", "amount", "description"] as const) {
			if (before[k] !== after[k]) diff[k] = { from: before[k], to: after[k] };
		}
		if (Object.keys(diff).length > 0) {
			await writeAuditLog("cash_deposit", id, "update", actorUserId, { diff });
		}
	}
	return after;
}

export async function deleteCashDeposit(
	id: string,
	actorUserId?: string | null,
): Promise<boolean> {
	const before = await getCashDeposit(id);
	const { error } = await getSupabase()
		.from("tks_cash_deposits")
		.delete()
		.eq("id", id);
	if (error) return false;
	await writeAuditLog("cash_deposit", id, "delete", actorUserId, {
		before: before ? stripDepositForAudit(before) : null,
	});
	return true;
}

function mapCashDeposit(d: Record<string, unknown>): CashDeposit {
	return {
		id: d.id as string,
		storeId: d.store_id as string,
		date: d.date as string,
		amount: d.amount as number,
		description: (d.description as string | null) ?? null,
		createdBy: (d.created_by as string | null) ?? null,
		createdAt: d.created_at as string,
	};
}

// ===== Cash Replenishment Requests (Phase 5) =====

export type ReplenishmentStatus =
	| "pending"
	| "approved"
	| "rejected"
	| "fulfilled";

export type CashReplenishmentRequest = {
	id: string;
	storeId: string;
	targetMonth: string; // 月初日 (YYYY-MM-01)
	requestedAmount: number;
	reason: string | null;
	status: ReplenishmentStatus;
	requestedBy: string | null;
	requestedAt: string;
	approvedBy: string | null;
	approvedAt: string | null;
	fulfilledDepositId: string | null;
	rejectionReason: string | null;
	createdAt: string;
};

export async function getReplenishmentRequests(): Promise<
	CashReplenishmentRequest[]
> {
	const { data, error } = await getSupabase()
		.from("tks_cash_replenishment_requests")
		.select("*")
		.order("requested_at", { ascending: false });
	if (error) console.error("getReplenishmentRequests:", error.message);
	return (data ?? []).map(mapReplenishment);
}

export async function getReplenishmentRequest(
	id: string,
): Promise<CashReplenishmentRequest | null> {
	const { data } = await getSupabase()
		.from("tks_cash_replenishment_requests")
		.select("*")
		.eq("id", id)
		.maybeSingle();
	return data ? mapReplenishment(data) : null;
}

export async function createReplenishmentRequest(input: {
	storeId: string;
	targetMonth: string; // 'YYYY-MM' or 'YYYY-MM-DD' をどちらも受ける
	requestedAmount: number;
	reason: string | null;
	requestedBy: string | null;
}): Promise<CashReplenishmentRequest> {
	// targetMonth は必ず月初日に正規化（'YYYY-MM' → 'YYYY-MM-01'）
	const month =
		input.targetMonth.length === 7
			? `${input.targetMonth}-01`
			: input.targetMonth;
	const { data, error } = await getSupabase()
		.from("tks_cash_replenishment_requests")
		.insert({
			store_id: input.storeId,
			target_month: month,
			requested_amount: input.requestedAmount,
			reason: input.reason,
			requested_by: input.requestedBy,
		})
		.select()
		.single();
	if (error) throw new Error(error.message);
	const mapped = mapReplenishment(data);
	await writeAuditLog(
		"replenishment_request",
		mapped.id,
		"create",
		input.requestedBy,
		{ after: stripReplenishmentForAudit(mapped) },
	);
	return mapped;
}

// 承認: pending → approved
export async function approveReplenishmentRequest(
	id: string,
	actorUserId: string,
): Promise<CashReplenishmentRequest | null> {
	const before = await getReplenishmentRequest(id);
	if (!before || before.status !== "pending") return null;
	const { data } = await getSupabase()
		.from("tks_cash_replenishment_requests")
		.update({
			status: "approved",
			approved_by: actorUserId,
			approved_at: new Date().toISOString(),
			rejection_reason: null,
		})
		.eq("id", id)
		.eq("status", "pending")
		.select()
		.maybeSingle();
	if (!data) return null;
	const after = mapReplenishment(data);
	await writeAuditLog("replenishment_request", id, "update", actorUserId, {
		diff: { status: { from: before.status, to: after.status } },
	});
	return after;
}

// 差戻し: pending → rejected
export async function rejectReplenishmentRequest(
	id: string,
	actorUserId: string,
	reason: string,
): Promise<CashReplenishmentRequest | null> {
	const before = await getReplenishmentRequest(id);
	if (!before || before.status !== "pending") return null;
	const { data } = await getSupabase()
		.from("tks_cash_replenishment_requests")
		.update({
			status: "rejected",
			rejection_reason: reason,
			approved_by: actorUserId,
			approved_at: new Date().toISOString(),
		})
		.eq("id", id)
		.eq("status", "pending")
		.select()
		.maybeSingle();
	if (!data) return null;
	const after = mapReplenishment(data);
	await writeAuditLog("replenishment_request", id, "update", actorUserId, {
		diff: { status: { from: before.status, to: after.status } },
	});
	return after;
}

// 支給済記録: approved → fulfilled。tks_cash_deposits を自動作成。
// 入金日と摘要は呼び出し元から指定（店長会の実施日など）。
export async function fulfillReplenishmentRequest(input: {
	id: string;
	actorUserId: string;
	depositDate: string;
	depositDescription: string | null;
}): Promise<CashReplenishmentRequest | null> {
	const before = await getReplenishmentRequest(input.id);
	if (!before || before.status !== "approved") return null;
	// まず deposit 行を作る → その id を fulfilled_deposit_id に紐付ける
	const deposit = await saveCashDeposit({
		storeId: before.storeId,
		date: input.depositDate,
		amount: before.requestedAmount,
		description: input.depositDescription ?? "補充申請による支給",
		createdBy: input.actorUserId,
	});
	const { data } = await getSupabase()
		.from("tks_cash_replenishment_requests")
		.update({
			status: "fulfilled",
			fulfilled_deposit_id: deposit.id,
		})
		.eq("id", input.id)
		.eq("status", "approved")
		.select()
		.maybeSingle();
	if (!data) {
		// 楽観ロック失敗時は作成済みの deposit を削除して整合性を保つ
		await getSupabase().from("tks_cash_deposits").delete().eq("id", deposit.id);
		return null;
	}
	const after = mapReplenishment(data);
	await writeAuditLog(
		"replenishment_request",
		input.id,
		"update",
		input.actorUserId,
		{
			diff: { status: { from: before.status, to: after.status } },
			fulfilled_deposit_id: deposit.id,
		},
	);
	return after;
}

function stripReplenishmentForAudit(
	r: CashReplenishmentRequest,
): Record<string, unknown> {
	return {
		storeId: r.storeId,
		targetMonth: r.targetMonth,
		requestedAmount: r.requestedAmount,
		reason: r.reason,
		status: r.status,
	};
}

function mapReplenishment(
	r: Record<string, unknown>,
): CashReplenishmentRequest {
	return {
		id: r.id as string,
		storeId: r.store_id as string,
		targetMonth: r.target_month as string,
		requestedAmount: r.requested_amount as number,
		reason: (r.reason as string | null) ?? null,
		status: r.status as ReplenishmentStatus,
		requestedBy: (r.requested_by as string | null) ?? null,
		requestedAt: r.requested_at as string,
		approvedBy: (r.approved_by as string | null) ?? null,
		approvedAt: (r.approved_at as string | null) ?? null,
		fulfilledDepositId: (r.fulfilled_deposit_id as string | null) ?? null,
		rejectionReason: (r.rejection_reason as string | null) ?? null,
		createdAt: r.created_at as string,
	};
}

// ===== Notifications =====

export async function getNotifications(
	recipientId: string,
): Promise<AppNotification[]> {
	const { data, error } = await getSupabase()
		.from("tks_notifications")
		.select("*")
		.eq("recipient_id", recipientId)
		.order("created_at", { ascending: false })
		.limit(50);
	if (error) console.error("getNotifications:", error.message);
	return (data ?? []).map(mapNotification);
}

export async function createNotifications(
	rows: {
		recipientId: string;
		type: NotificationType;
		receiptId: string | null;
		title: string;
		body: string | null;
	}[],
): Promise<void> {
	if (rows.length === 0) return;
	const { error } = await getSupabase()
		.from("tks_notifications")
		.insert(
			rows.map((r) => ({
				recipient_id: r.recipientId,
				type: r.type,
				receipt_id: r.receiptId,
				title: r.title,
				body: r.body,
			})),
		);
	if (error) console.error("createNotifications:", error.message);
}

export async function markNotificationRead(id: string): Promise<void> {
	const { error } = await getSupabase()
		.from("tks_notifications")
		.update({ is_read: true })
		.eq("id", id);
	if (error) console.error("markNotificationRead:", error.message);
}

export async function markAllNotificationsRead(
	recipientId: string,
): Promise<void> {
	const { error } = await getSupabase()
		.from("tks_notifications")
		.update({ is_read: true })
		.eq("recipient_id", recipientId)
		.eq("is_read", false);
	if (error) console.error("markAllNotificationsRead:", error.message);
}

function mapNotification(n: Record<string, unknown>): AppNotification {
	return {
		id: n.id as string,
		recipientId: n.recipient_id as string,
		type: n.type as NotificationType,
		receiptId: (n.receipt_id as string | null) ?? null,
		title: n.title as string,
		body: (n.body as string | null) ?? null,
		isRead: n.is_read as boolean,
		createdAt: n.created_at as string,
	};
}

// ===== Image =====

const MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.7;

export function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
			const w = Math.round(img.width * scale);
			const h = Math.round(img.height * scale);
			const canvas = document.createElement("canvas");
			canvas.width = w;
			canvas.height = h;
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				reject(new Error("Canvas not supported"));
				return;
			}
			ctx.drawImage(img, 0, 0, w, h);
			resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
		};
		img.onerror = reject;
		const reader = new FileReader();
		reader.onload = () => {
			img.src = reader.result as string;
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}
