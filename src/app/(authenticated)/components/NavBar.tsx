"use client";

import { FolderOpen, Menu, Receipt, Settings } from "lucide-react";
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
import { cn } from "@/lib/utils";

const navItems = [
	{ href: PAGE_PATH.receipts, label: "レシート", icon: Receipt },
	{ href: PAGE_PATH.projects, label: "プロジェクト", icon: FolderOpen },
	{ href: PAGE_PATH.settings, label: "設定", icon: Settings },
];

export function NavBar() {
	const pathname = usePathname();

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
			</div>
		</header>
	);
}
