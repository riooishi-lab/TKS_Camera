"use client";

import { ChevronRight, Store, Tag, Users } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PAGE_PATH } from "@/constants/pagePath";
import { useAuth } from "@/contexts/AuthContext";

export default function SettingsPage() {
	const { tksUser } = useAuth();

	if (tksUser?.role === "staff") {
		return (
			<div className="py-12 text-center text-muted-foreground">
				このページにはアクセスできません
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<h1 className="text-2xl font-bold">設定</h1>
			<Card>
				<CardContent className="p-0">
					<ul className="divide-y">
						<SettingsLink
							href={PAGE_PATH.users}
							icon={<Users className="h-4 w-4" />}
							label="ユーザー管理"
						/>
						<SettingsLink
							href={PAGE_PATH.stores}
							icon={<Store className="h-4 w-4" />}
							label="店舗管理"
						/>
						<SettingsLink
							href={PAGE_PATH.tags}
							icon={<Tag className="h-4 w-4" />}
							label="タグ管理"
						/>
					</ul>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-lg">アプリについて</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm text-muted-foreground">
					<p>
						レシートスキャナーは、カメラで撮影したレシートをAIが自動で読み取り・管理するアプリです。
					</p>
				</CardContent>
			</Card>
		</div>
	);
}

function SettingsLink({
	href,
	icon,
	label,
}: {
	href: string;
	icon: React.ReactNode;
	label: string;
}) {
	return (
		<li>
			<Link
				href={href}
				className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
			>
				<span className="flex items-center gap-2 text-sm font-medium">
					{icon}
					{label}
				</span>
				<ChevronRight className="h-4 w-4 text-muted-foreground" />
			</Link>
		</li>
	);
}
