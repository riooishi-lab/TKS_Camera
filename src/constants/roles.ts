import type { UserRole } from "@/libs/storage";

export const USER_ROLES: readonly UserRole[] = [
	"store_staff",
	"store_manager",
	"hq_accountant",
	"president",
] as const;

export const ROLE_LABELS: Record<UserRole, string> = {
	store_staff: "店舗担当者",
	store_manager: "店舗管理者",
	hq_accountant: "本社経理",
	president: "社長",
};

// 店舗ロール（自店舗のレシートのみ閲覧/起票できる）
export function isStoreRole(role: UserRole | undefined): boolean {
	return role === "store_staff" || role === "store_manager";
}
