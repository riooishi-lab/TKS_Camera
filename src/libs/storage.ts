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

// ===== Image =====

export function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}
