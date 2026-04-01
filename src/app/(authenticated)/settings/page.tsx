import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { createClient } from "@/libs/supabase/server";
import { OrganizationForm } from "./components/OrganizationForm";
import { ProfileForm } from "./components/ProfileForm";

export default async function SettingsPage() {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	const { data: profile } = await supabase
		.from("profiles")
		.select("display_name, role, organization_id")
		.eq("id", user?.id)
		.single();

	const { data: org } = await supabase
		.from("organizations")
		.select("name")
		.eq("id", profile?.organization_id)
		.single();

	const { data: members } = await supabase
		.from("profiles")
		.select("id, display_name, role, created_at")
		.eq("organization_id", profile?.organization_id)
		.is("deleted_at", null)
		.order("created_at");

	const isAdmin = profile?.role === "owner" || profile?.role === "admin";

	const roleLabel = (role: string) => {
		switch (role) {
			case "owner":
				return "オーナー";
			case "admin":
				return "管理者";
			default:
				return "メンバー";
		}
	};

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<h1 className="text-2xl font-bold">設定</h1>

			{/* プロフィール設定 */}
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">プロフィール</CardTitle>
				</CardHeader>
				<CardContent>
					<ProfileForm
						displayName={profile?.display_name}
						email={user?.email ?? ""}
					/>
				</CardContent>
			</Card>

			{/* 組織設定 */}
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">組織設定</CardTitle>
				</CardHeader>
				<CardContent>
					<OrganizationForm name={org?.name} isAdmin={isAdmin} />
				</CardContent>
			</Card>

			{/* メンバー一覧 */}
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">メンバー</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>名前</TableHead>
									<TableHead>役割</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{members?.map((member) => (
									<TableRow key={member.id}>
										<TableCell className="font-medium">
											{member.display_name}
											{member.id === user?.id && (
												<span className="ml-2 text-xs text-muted-foreground">
													（あなた）
												</span>
											)}
										</TableCell>
										<TableCell>
											<Badge variant="secondary">
												{roleLabel(member.role)}
											</Badge>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
