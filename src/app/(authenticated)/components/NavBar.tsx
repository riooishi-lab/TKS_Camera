"use client";

import {
	BarChart3,
	Building2,
	FolderOpen,
	LogOut,
	Menu,
	Receipt,
	Settings,
	Users,
	UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { PAGE_PATH } from "@/constants/pagePath";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/libs/storage";

type NavItem = {
	href: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	roles?: UserRole[];
};

const allNavItems: NavItem[] = [
	{ href: PAGE_PATH.receipts, label: "レシート", icon: Receipt },
	{ href: PAGE_PATH.reports, label: "レポート", icon: BarChart3 },
	{
		href: PAGE_PATH.projects,
		label: "プロジェクト",
		icon: FolderOpen,
		roles: ["admin", "editor"],
	},
	{
		href: PAGE_PATH.clients,
		label: "顧客企業",
		icon: Building2,
		roles: ["admin", "editor"],
	},
	{
		href: PAGE_PATH.staff,
		label: "担当者",
		icon: Users,
		roles: ["admin", "editor"],
	},
	{
		href: PAGE_PATH.users,
		label: "ユーザー管理",
		icon: UsersRound,
		roles: ["admin"],
	},
	{
		href: PAGE_PATH.settings,
		label: "設定",
		icon: Settings,
		roles: ["admin", "editor"],
	},
];

export function NavBar() {
	const pathname = usePathname();
	const { tksUser, logout } = useAuth();
	const role = tksUser?.role ?? "viewer";

	const navItems = allNavItems.filter(
		(item) => !item.roles || item.roles.includes(role),
	);

	const handleLogout = async () => {
		await logout();
	};

	return (
		<header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="container mx-auto flex h-14 items-center px-4">
				<Sheet>
					<SheetTrigger
						render={
							<Button variant="ghost" size="icon" className="md:hidden" />
						}
					>
						<Menu className="h-5 w-5" />
						<span className="sr-only">メニュー</span>
					</SheetTrigger>
					<SheetContent side="left" className="w-64">
						<SheetHeader>
							<SheetTitle className="text-left">レシートスキャナー</SheetTitle>
						</SheetHeader>
						<nav className="mt-4 flex flex-col gap-2">
							{navItems.map((item) => (
								<Link
									key={item.href}
									href={item.href}
									className={cn(
										"flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
										pathname.startsWith(item.href)
											? "bg-accent text-accent-foreground"
											: "text-muted-foreground",
									)}
								>
									<item.icon className="h-4 w-4" />
									{item.label}
								</Link>
							))}
							<button
								type="button"
								onClick={handleLogout}
								className="mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
							>
								<LogOut className="h-4 w-4" />
								ログアウト
							</button>
						</nav>
					</SheetContent>
				</Sheet>

				<Link
					href={PAGE_PATH.receipts}
					className="mr-6 flex items-center gap-2 font-semibold"
				>
					<Receipt className="h-5 w-5" />
					<span className="hidden sm:inline">レシートスキャナー</span>
				</Link>

				<nav className="hidden flex-1 items-center gap-1 md:flex">
					{navItems.map((item) => (
						<Link
							key={item.href}
							href={item.href}
							className={cn(
								"flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
								pathname.startsWith(item.href)
									? "bg-accent text-accent-foreground"
									: "text-muted-foreground",
							)}
						>
							<item.icon className="h-4 w-4" />
							{item.label}
						</Link>
					))}
				</nav>

				<div className="ml-auto hidden items-center gap-2 md:flex">
					{tksUser && (
						<span className="text-xs text-muted-foreground">
							{tksUser.name ?? tksUser.email}
						</span>
					)}
					<Button variant="ghost" size="icon" onClick={handleLogout}>
						<LogOut className="h-4 w-4" />
					</Button>
				</div>
			</div>
		</header>
	);
}
