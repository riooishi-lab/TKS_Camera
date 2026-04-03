import { getSupabase } from "./supabase";

// ===== Types =====

export type Project = {
	id: string;
	name: string;
	description: string | null;
	clientId: string | null;
	isActive: boolean;
	createdAt: string;
};

export type Client = {
	id: string;
	name: string;
	createdAt: string;
};

export type Staff = {
	id: string;
	name: string;
	createdAt: string;
};

export type UserRole = "admin" | "editor" | "viewer";
export type UserStatus = "pending" | "active";

export type TksUser = {
	id: string;
	firebaseUid: string | null;
	email: string;
	name: string | null;
	role: UserRole;
	status: UserStatus;
	inviteCode: string | null;
	invitedBy: string | null;
	createdAt: string;
};

export type Receipt = {
	id: string;
	date: string | null;
	payee: string | null;
	amount: number | null;
	taxAmount: number | null;
	taxRateCategory: "8" | "10" | "mixed" | null;
	accountCategory: string | null;
	description: string | null;
	invoiceRegistrationNo: string | null;
	projectId: string | null;
	clientId: string | null;
	personInCharge: string | null;
	imageUrl: string;
	aiRawResponse: Record<string, unknown> | null;
	aiConfidence: number | null;
	isAiVerified: boolean;
	createdAt: string;
	updatedAt: string;
};

// ===== Receipts =====

export async function getReceipts(): Promise<Receipt[]> {
	const { data } = await getSupabase()
		.from("tks_receipts")
		.select("*")
		.order("created_at", { ascending: false });
	return (data ?? []).map(mapReceipt);
}

export async function getReceipt(id: string): Promise<Receipt | null> {
	const { data } = await getSupabase()
		.from("tks_receipts")
		.select("*")
		.eq("id", id)
		.single();
	return data ? mapReceipt(data) : null;
}

export async function saveReceipt(
	input: Omit<Receipt, "id" | "createdAt" | "updatedAt">,
): Promise<Receipt> {
	const { data, error } = await getSupabase()
		.from("tks_receipts")
		.insert({
			date: input.date,
			payee: input.payee,
			amount: input.amount,
			tax_amount: input.taxAmount,
			tax_rate_category: input.taxRateCategory,
			account_category: input.accountCategory,
			description: input.description,
			invoice_registration_no: input.invoiceRegistrationNo,
			project_id: input.projectId,
			client_id: input.clientId,
			person_in_charge: input.personInCharge,
			image_url: input.imageUrl,
			ai_raw_response: input.aiRawResponse,
			ai_confidence: input.aiConfidence,
			is_ai_verified: input.isAiVerified,
		})
		.select()
		.single();
	if (error) throw new Error(error.message);
	return mapReceipt(data);
}

export async function updateReceipt(
	id: string,
	input: Partial<Omit<Receipt, "id" | "createdAt">>,
): Promise<Receipt | null> {
	const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
	if (input.date !== undefined) row.date = input.date;
	if (input.payee !== undefined) row.payee = input.payee;
	if (input.amount !== undefined) row.amount = input.amount;
	if (input.taxAmount !== undefined) row.tax_amount = input.taxAmount;
	if (input.taxRateCategory !== undefined) row.tax_rate_category = input.taxRateCategory;
	if (input.accountCategory !== undefined) row.account_category = input.accountCategory;
	if (input.description !== undefined) row.description = input.description;
	if (input.invoiceRegistrationNo !== undefined) row.invoice_registration_no = input.invoiceRegistrationNo;
	if (input.projectId !== undefined) row.project_id = input.projectId;
	if (input.clientId !== undefined) row.client_id = input.clientId;
	if (input.personInCharge !== undefined) row.person_in_charge = input.personInCharge;
	if (input.isAiVerified !== undefined) row.is_ai_verified = input.isAiVerified;

	const { data } = await getSupabase()
		.from("tks_receipts")
		.update(row)
		.eq("id", id)
		.select()
		.single();
	return data ? mapReceipt(data) : null;
}

export async function deleteReceipt(id: string): Promise<boolean> {
	const { error } = await getSupabase().from("tks_receipts").delete().eq("id", id);
	return !error;
}

function mapReceipt(r: Record<string, unknown>): Receipt {
	return {
		id: r.id as string,
		date: r.date as string | null,
		payee: r.payee as string | null,
		amount: r.amount as number | null,
		taxAmount: r.tax_amount as number | null,
		taxRateCategory: r.tax_rate_category as "8" | "10" | "mixed" | null,
		accountCategory: r.account_category as string | null,
		description: r.description as string | null,
		invoiceRegistrationNo: r.invoice_registration_no as string | null,
		projectId: r.project_id as string | null,
		clientId: r.client_id as string | null,
		personInCharge: r.person_in_charge as string | null,
		imageUrl: r.image_url as string,
		aiRawResponse: r.ai_raw_response as Record<string, unknown> | null,
		aiConfidence: r.ai_confidence as number | null,
		isAiVerified: r.is_ai_verified as boolean,
		createdAt: r.created_at as string,
		updatedAt: r.updated_at as string,
	};
}

// ===== Projects =====

export async function getProjects(): Promise<Project[]> {
	const { data } = await getSupabase()
		.from("tks_projects")
		.select("*")
		.order("created_at", { ascending: false });
	return (data ?? []).map(mapProject);
}

export async function saveProject(
	name: string,
	description: string | null,
	clientId: string | null = null,
): Promise<Project> {
	const { data, error } = await getSupabase()
		.from("tks_projects")
		.insert({ name, description, client_id: clientId })
		.select()
		.single();
	if (error) throw new Error(error.message);
	return mapProject(data);
}

export async function updateProject(
	id: string,
	input: Partial<Omit<Project, "id" | "createdAt">>,
): Promise<Project | null> {
	const row: Record<string, unknown> = {};
	if (input.name !== undefined) row.name = input.name;
	if (input.description !== undefined) row.description = input.description;
	if (input.clientId !== undefined) row.client_id = input.clientId;
	if (input.isActive !== undefined) row.is_active = input.isActive;

	const { data } = await getSupabase()
		.from("tks_projects")
		.update(row)
		.eq("id", id)
		.select()
		.single();
	return data ? mapProject(data) : null;
}

export async function deleteProject(id: string): Promise<boolean> {
	const { error } = await getSupabase().from("tks_projects").delete().eq("id", id);
	return !error;
}

function mapProject(p: Record<string, unknown>): Project {
	return {
		id: p.id as string,
		name: p.name as string,
		description: p.description as string | null,
		clientId: p.client_id as string | null,
		isActive: p.is_active as boolean,
		createdAt: p.created_at as string,
	};
}

// ===== Clients =====

export async function getClients(): Promise<Client[]> {
	const { data } = await getSupabase()
		.from("tks_clients")
		.select("*")
		.order("created_at", { ascending: false });
	return (data ?? []).map(mapClient);
}

export async function saveClient(name: string): Promise<Client> {
	const { data, error } = await getSupabase()
		.from("tks_clients")
		.insert({ name })
		.select()
		.single();
	if (error) throw new Error(error.message);
	return mapClient(data);
}

export async function updateClient(
	id: string,
	input: Partial<Omit<Client, "id" | "createdAt">>,
): Promise<Client | null> {
	const { data } = await getSupabase()
		.from("tks_clients")
		.update(input)
		.eq("id", id)
		.select()
		.single();
	return data ? mapClient(data) : null;
}

export async function deleteClient(id: string): Promise<boolean> {
	const { error } = await getSupabase().from("tks_clients").delete().eq("id", id);
	return !error;
}

function mapClient(c: Record<string, unknown>): Client {
	return {
		id: c.id as string,
		name: c.name as string,
		createdAt: c.created_at as string,
	};
}

// ===== Staff =====

export async function getStaff(): Promise<Staff[]> {
	const { data } = await getSupabase()
		.from("tks_staff")
		.select("*")
		.order("created_at", { ascending: false });
	return (data ?? []).map(mapStaff);
}

export async function saveStaff(name: string): Promise<Staff> {
	const { data, error } = await getSupabase()
		.from("tks_staff")
		.insert({ name })
		.select()
		.single();
	if (error) throw new Error(error.message);
	return mapStaff(data);
}

export async function updateStaff(
	id: string,
	input: Partial<Omit<Staff, "id" | "createdAt">>,
): Promise<Staff | null> {
	const { data } = await getSupabase()
		.from("tks_staff")
		.update(input)
		.eq("id", id)
		.select()
		.single();
	return data ? mapStaff(data) : null;
}

export async function deleteStaff(id: string): Promise<boolean> {
	const { error } = await getSupabase().from("tks_staff").delete().eq("id", id);
	return !error;
}

function mapStaff(s: Record<string, unknown>): Staff {
	return {
		id: s.id as string,
		name: s.name as string,
		createdAt: s.created_at as string,
	};
}

// ===== Users =====

export async function getUserByFirebaseUid(
	uid: string,
): Promise<TksUser | null> {
	const { data } = await getSupabase()
		.from("tks_users")
		.select("*")
		.eq("firebase_uid", uid)
		.single();
	return data ? mapUser(data) : null;
}

export async function getUserByEmail(
	email: string,
): Promise<TksUser | null> {
	const { data } = await getSupabase()
		.from("tks_users")
		.select("*")
		.eq("email", email)
		.single();
	return data ? mapUser(data) : null;
}

export async function getUserByInviteCode(
	code: string,
): Promise<TksUser | null> {
	const { data } = await getSupabase()
		.from("tks_users")
		.select("*")
		.eq("invite_code", code)
		.eq("status", "pending")
		.single();
	return data ? mapUser(data) : null;
}

export async function getUsers(): Promise<TksUser[]> {
	const { data } = await getSupabase()
		.from("tks_users")
		.select("*")
		.order("created_at", { ascending: false });
	return (data ?? []).map(mapUser);
}

export async function createUser(input: {
	email: string;
	role: UserRole;
	inviteCode: string;
	invitedBy: string | null;
}): Promise<TksUser> {
	const { data, error } = await getSupabase()
		.from("tks_users")
		.insert({
			email: input.email,
			role: input.role,
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
	}>,
): Promise<TksUser | null> {
	const row: Record<string, unknown> = {};
	if (input.firebaseUid !== undefined) row.firebase_uid = input.firebaseUid;
	if (input.email !== undefined) row.email = input.email;
	if (input.name !== undefined) row.name = input.name;
	if (input.role !== undefined) row.role = input.role;
	if (input.status !== undefined) row.status = input.status;

	const { data } = await getSupabase()
		.from("tks_users")
		.update(row)
		.eq("id", id)
		.select()
		.single();
	return data ? mapUser(data) : null;
}

export async function deleteUser(id: string): Promise<boolean> {
	const { error } = await getSupabase()
		.from("tks_users")
		.delete()
		.eq("id", id);
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
		inviteCode: u.invite_code as string | null,
		invitedBy: u.invited_by as string | null,
		createdAt: u.created_at as string,
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
