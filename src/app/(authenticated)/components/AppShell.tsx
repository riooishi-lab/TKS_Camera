"use client";

import {
	BarChart3,
	BookOpen,
	LogOut,
	Menu,
	PanelLeftClose,
	PanelLeftOpen,
	Receipt,
	Settings,
	UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
	{
		href: PAGE_PATH.cashBook,
		label: "小口現金帳",
		icon: BookOpen,
		roles: ["store_manager", "hq_accountant", "president"],
	},
	{
		href: PAGE_PATH.reports,
		label: "レポート",
		icon: BarChart3,
		roles: ["store_manager", "hq_accountant", "president"],
	},
	{
		href: PAGE_PATH.users,
		label: "ユーザー管理",
		icon: UsersRound,
		roles: ["hq_accountant"],
	},
	{
		href: PAGE_PATH.settings,
		label: "設定",
		icon: Settings,
		roles: ["hq_accountant"],
	},
];

function isActiveLink(pathname: string, href: string): boolean {
	return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const { tksUser, logout } = useAuth();
	const role: UserRole = tksUser?.role ?? "staff";

	const navItems = allNavItems.filter(
		(item) => !item.roles || item.roles.includes(role),
	);

	const [sheetOpen, setSheetOpen] = useState(false);
	const [collapsed, setCollapsed] = useState(false);

	const handleLogout = async () => {
		setSheetOpen(false);
		await logout();
	};

	return (
		<div className="min-h-screen bg-background">
			{/* デスクトップ用固定サイドバー */}
			<aside
				id="app-sidebar"
				aria-label="メインナビゲーション"
				className={cn(
					"fixed inset-y-0 left-0 z-40 hidden border-r bg-background transition-[width] md:flex md:flex-col",
					collapsed ? "w-16" : "w-60",
				)}
			>
				<div className="flex h-14 items-center border-b px-3">
					<Link
						href={PAGE_PATH.receipts}
						className="flex items-center gap-2 overflow-hidden font-semibold"
					>
						<Receipt className="h-5 w-5 shrink-0" />
						{!collapsed && <span className="truncate">レシートスキャナー</span>}
					</Link>
				</div>
				<nav className="flex-1 overflow-y-auto p-2">
					{navItems.map((item) => {
						const active = isActiveLink(pathname, item.href);
						return (
							<Link
								key={item.href}
								href={item.href}
								aria-label={collapsed ? item.label : undefined}
								aria-current={active ? "page" : undefined}
								title={collapsed ? item.label : undefined}
								className={cn(
									"flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
									active
										? "bg-accent text-accent-foreground"
										: "text-muted-foreground",
									collapsed && "justify-center px-2",
								)}
							>
								<item.icon className="h-5 w-5 shrink-0" />
								{!collapsed && <span className="truncate">{item.label}</span>}
							</Link>
						);
					})}
				</nav>
			</aside>

			{/* メインカラム（サイドバー分パディング） */}
			<div
				className={cn(
					"flex min-h-screen flex-col transition-[padding]",
					collapsed ? "md:pl-16" : "md:pl-60",
				)}
			>
				{/* 薄いトップヘッダー */}
				<header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
					{/* モバイル: ハンバーガーでドロワー */}
					<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
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
								<SheetTitle className="text-left">
									レシートスキャナー
								</SheetTitle>
							</SheetHeader>
							<nav
								aria-label="メインナビゲーション"
								className="mt-4 flex flex-col gap-1"
							>
								{navItems.map((item) => {
									const active = isActiveLink(pathname, item.href);
									return (
										<Link
											key={item.href}
											href={item.href}
											aria-current={active ? "page" : undefined}
											onClick={() => setSheetOpen(false)}
											className={cn(
												"flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
												active
													? "bg-accent text-accent-foreground"
													: "text-muted-foreground",
											)}
										>
											<item.icon className="h-4 w-4" />
											{item.label}
										</Link>
									);
								})}
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

					{/* デスクトップ: 折りたたみトグル */}
					<Button
						variant="ghost"
						size="icon"
						className="hidden md:inline-flex"
						onClick={() => setCollapsed((c) => !c)}
						aria-label={collapsed ? "サイドバーを開く" : "サイドバーを閉じる"}
						aria-expanded={!collapsed}
						aria-controls="app-sidebar"
					>
						{collapsed ? (
							<PanelLeftOpen className="h-5 w-5" />
						) : (
							<PanelLeftClose className="h-5 w-5" />
						)}
					</Button>

					{/* モバイル時のみロゴをヘッダーに表示（サイドバーが無いため） */}
					<Link
						href={PAGE_PATH.receipts}
						className="flex items-center gap-2 font-semibold md:hidden"
					>
						<Receipt className="h-5 w-5" />
						<span className="hidden sm:inline">レシートスキャナー</span>
					</Link>

					<div className="ml-auto flex items-center gap-2">
						{tksUser && (
							<span className="text-xs text-muted-foreground">
								{tksUser.name ?? tksUser.email}
							</span>
						)}
						<Button variant="ghost" size="icon" onClick={handleLogout}>
							<LogOut className="h-4 w-4" />
							<span className="sr-only">ログアウト</span>
						</Button>
					</div>
				</header>

				<main className="container mx-auto flex-1 px-4 py-6">{children}</main>
			</div>
		</div>
	);
}
