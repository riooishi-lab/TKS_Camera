import type { Receipt } from "@/types/receipt";

const RECEIPTS_KEY = "receipt-scanner:receipts";
const PROJECTS_KEY = "receipt-scanner:projects";

export type Project = {
	id: string;
	name: string;
	description: string | null;
	isActive: boolean;
	createdAt: string;
};

function generateId(): string {
	return crypto.randomUUID();
}

// ===== Receipts =====

export function getReceipts(): Receipt[] {
	if (typeof window === "undefined") return [];
	const raw = localStorage.getItem(RECEIPTS_KEY);
	if (!raw) return [];
	return JSON.parse(raw);
}

export function getReceipt(id: string): Receipt | null {
	return getReceipts().find((r) => r.id === id) ?? null;
}

export function saveReceipt(
	data: Omit<Receipt, "id" | "createdAt" | "updatedAt" | "organizationId" | "uploadedBy">,
): Receipt {
	const receipts = getReceipts();
	const now = new Date().toISOString();
	const receipt: Receipt = {
		...data,
		id: generateId(),
		organizationId: "",
		uploadedBy: "",
		createdAt: now,
		updatedAt: now,
	};
	receipts.unshift(receipt);
	localStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts));
	return receipt;
}

export function updateReceipt(
	id: string,
	data: Partial<Omit<Receipt, "id" | "createdAt">>,
): Receipt | null {
	const receipts = getReceipts();
	const index = receipts.findIndex((r) => r.id === id);
	if (index === -1) return null;
	receipts[index] = {
		...receipts[index],
		...data,
		updatedAt: new Date().toISOString(),
	};
	localStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts));
	return receipts[index];
}

export function deleteReceipt(id: string): boolean {
	const receipts = getReceipts();
	const filtered = receipts.filter((r) => r.id !== id);
	if (filtered.length === receipts.length) return false;
	localStorage.setItem(RECEIPTS_KEY, JSON.stringify(filtered));
	return true;
}

// ===== Projects =====

export function getProjects(): Project[] {
	if (typeof window === "undefined") return [];
	const raw = localStorage.getItem(PROJECTS_KEY);
	if (!raw) return [];
	return JSON.parse(raw);
}

export function saveProject(name: string, description: string | null): Project {
	const projects = getProjects();
	const project: Project = {
		id: generateId(),
		name,
		description,
		isActive: true,
		createdAt: new Date().toISOString(),
	};
	projects.unshift(project);
	localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
	return project;
}

export function updateProject(
	id: string,
	data: Partial<Omit<Project, "id" | "createdAt">>,
): Project | null {
	const projects = getProjects();
	const index = projects.findIndex((p) => p.id === id);
	if (index === -1) return null;
	projects[index] = { ...projects[index], ...data };
	localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
	return projects[index];
}

export function deleteProject(id: string): boolean {
	const projects = getProjects();
	const filtered = projects.filter((p) => p.id !== id);
	if (filtered.length === projects.length) return false;
	localStorage.setItem(PROJECTS_KEY, JSON.stringify(filtered));
	return true;
}

// ===== Clients (顧客企業) =====

const CLIENTS_KEY = "receipt-scanner:clients";

export type Client = {
	id: string;
	name: string;
	createdAt: string;
};

export function getClients(): Client[] {
	if (typeof window === "undefined") return [];
	const raw = localStorage.getItem(CLIENTS_KEY);
	if (!raw) return [];
	return JSON.parse(raw);
}

export function saveClient(name: string): Client {
	const clients = getClients();
	const client: Client = {
		id: generateId(),
		name,
		createdAt: new Date().toISOString(),
	};
	clients.unshift(client);
	localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
	return client;
}

export function updateClient(
	id: string,
	data: Partial<Omit<Client, "id" | "createdAt">>,
): Client | null {
	const clients = getClients();
	const index = clients.findIndex((c) => c.id === id);
	if (index === -1) return null;
	clients[index] = { ...clients[index], ...data };
	localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
	return clients[index];
}

export function deleteClient(id: string): boolean {
	const clients = getClients();
	const filtered = clients.filter((c) => c.id !== id);
	if (filtered.length === clients.length) return false;
	localStorage.setItem(CLIENTS_KEY, JSON.stringify(filtered));
	return true;
}

// ===== Staff (担当者) =====

const STAFF_KEY = "receipt-scanner:staff";

export type Staff = {
	id: string;
	name: string;
	createdAt: string;
};

export function getStaff(): Staff[] {
	if (typeof window === "undefined") return [];
	const raw = localStorage.getItem(STAFF_KEY);
	if (!raw) return [];
	return JSON.parse(raw);
}

export function saveStaff(name: string): Staff {
	const staffList = getStaff();
	const staff: Staff = {
		id: generateId(),
		name,
		createdAt: new Date().toISOString(),
	};
	staffList.unshift(staff);
	localStorage.setItem(STAFF_KEY, JSON.stringify(staffList));
	return staff;
}

export function updateStaff(
	id: string,
	data: Partial<Omit<Staff, "id" | "createdAt">>,
): Staff | null {
	const staffList = getStaff();
	const index = staffList.findIndex((s) => s.id === id);
	if (index === -1) return null;
	staffList[index] = { ...staffList[index], ...data };
	localStorage.setItem(STAFF_KEY, JSON.stringify(staffList));
	return staffList[index];
}

export function deleteStaff(id: string): boolean {
	const staffList = getStaff();
	const filtered = staffList.filter((s) => s.id !== id);
	if (filtered.length === staffList.length) return false;
	localStorage.setItem(STAFF_KEY, JSON.stringify(filtered));
	return true;
}

// ===== Seed Data (初期データ) =====

const SEED_KEY = "receipt-scanner:seeded";

export function seedIfEmpty(): void {
	if (typeof window === "undefined") return;
	if (localStorage.getItem(SEED_KEY)) return;

	// プロジェクト5件
	const projectNames = [
		"東京駅前ビル改修工事",
		"大阪支社オフィス移転",
		"名古屋新工場建設",
		"福岡商業施設リニューアル",
		"札幌マンション新築",
	];
	for (const name of projectNames) {
		saveProject(name, null);
	}

	// 企業3社
	const clientNames = ["株式会社山田建設", "有限会社鈴木工務店", "合同会社佐藤設計"];
	for (const name of clientNames) {
		saveClient(name);
	}

	// 担当2名
	const staffNames = ["田中太郎", "佐藤花子"];
	for (const name of staffNames) {
		saveStaff(name);
	}

	localStorage.setItem(SEED_KEY, "true");
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
