"use client";

import { FolderOpen, LogOut, Menu, Receipt, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/signout/actions/signOut";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { PAGE_PATH } from "@/constants/pagePath";
import { cn } from "@/lib/utils";

const navItems = [
	{ href: PAGE_PATH.receipts, label: "レシート", icon: Receipt },
	{ href: PAGE_PATH.projects, label: "プロジェクト", icon: FolderOpen },
	{ href: PAGE_PATH.settings, label: "設定", icon: Settings },
];

type NavBarProps = {
	displayName: string;
	organizationName: string;
};

export function NavBar({ displayName, organizationName }: NavBarProps) {
	const pathname = usePathname();

	return (
		<header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="container mx-auto flex h-14 items-center px-4">
				{/* モバイルメニュー */}
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
						</nav>
					</SheetContent>
				</Sheet>

				{/* ロゴ */}
				<Link
					href={PAGE_PATH.receipts}
					className="mr-6 flex items-center gap-2 font-semibold"
				>
					<Receipt className="h-5 w-5" />
					<span className="hidden sm:inline">レシートスキャナー</span>
				</Link>

				{/* デスクトップナビ */}
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

				{/* ユーザーメニュー */}
				<div className="ml-auto">
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button variant="ghost" className="gap-2" />}
						>
							<span className="hidden text-xs text-muted-foreground sm:inline">
								{organizationName}
							</span>
							<span className="text-sm font-medium">{displayName}</span>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem render={<Link href={PAGE_PATH.settings} />}>
								<Settings className="mr-2 h-4 w-4" />
								設定
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem>
								<form action={signOut}>
									<button type="submit" className="flex w-full items-center">
										<LogOut className="mr-2 h-4 w-4" />
										ログアウト
									</button>
								</form>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</header>
	);
}
