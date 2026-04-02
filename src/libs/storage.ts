import { supabase } from "./supabase";

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
	const { data } = await supabase
		.from("tks_receipts")
		.select("*")
		.order("created_at", { ascending: false });
	return (data ?? []).map(mapReceipt);
}

export async function getReceipt(id: string): Promise<Receipt | null> {
	const { data } = await supabase
		.from("tks_receipts")
		.select("*")
		.eq("id", id)
		.single();
	return data ? mapReceipt(data) : null;
}

export async function saveReceipt(
	input: Omit<Receipt, "id" | "createdAt" | "updatedAt">,
): Promise<Receipt> {
	const { data, error } = await supabase
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

	const { data } = await supabase
		.from("tks_receipts")
		.update(row)
		.eq("id", id)
		.select()
		.single();
	return data ? mapReceipt(data) : null;
}

export async function deleteReceipt(id: string): Promise<boolean> {
	const { error } = await supabase.from("tks_receipts").delete().eq("id", id);
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
	const { data } = await supabase
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
	const { data, error } = await supabase
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

	const { data } = await supabase
		.from("tks_projects")
		.update(row)
		.eq("id", id)
		.select()
		.single();
	return data ? mapProject(data) : null;
}

export async function deleteProject(id: string): Promise<boolean> {
	const { error } = await supabase.from("tks_projects").delete().eq("id", id);
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
	const { data } = await supabase
		.from("tks_clients")
		.select("*")
		.order("created_at", { ascending: false });
	return (data ?? []).map(mapClient);
}

export async function saveClient(name: string): Promise<Client> {
	const { data, error } = await supabase
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
	const { data } = await supabase
		.from("tks_clients")
		.update(input)
		.eq("id", id)
		.select()
		.single();
	return data ? mapClient(data) : null;
}

export async function deleteClient(id: string): Promise<boolean> {
	const { error } = await supabase.from("tks_clients").delete().eq("id", id);
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
	const { data } = await supabase
		.from("tks_staff")
		.select("*")
		.order("created_at", { ascending: false });
	return (data ?? []).map(mapStaff);
}

export async function saveStaff(name: string): Promise<Staff> {
	const { data, error } = await supabase
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
	const { data } = await supabase
		.from("tks_staff")
		.update(input)
		.eq("id", id)
		.select()
		.single();
	return data ? mapStaff(data) : null;
}

export async function deleteStaff(id: string): Promise<boolean> {
	const { error } = await supabase.from("tks_staff").delete().eq("id", id);
	return !error;
}

function mapStaff(s: Record<string, unknown>): Staff {
	return {
		id: s.id as string,
		name: s.name as string,
		createdAt: s.created_at as string,
	};
}

// ===== Image =====

export function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}
