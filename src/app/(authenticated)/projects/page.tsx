import {
	Table,
	TableBody,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { createClient } from "@/libs/supabase/server";
import { CreateProjectDialog } from "./components/CreateProjectDialog";
import { ProjectRow } from "./components/ProjectRow";

export default async function ProjectsPage() {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	const { data: profile } = await supabase
		.from("profiles")
		.select("organization_id")
		.eq("id", user?.id)
		.single();

	const { data: projects } = await supabase
		.from("projects")
		.select("id, name, description, is_active, created_at")
		.eq("organization_id", profile?.organization_id)
		.is("deleted_at", null)
		.order("created_at", { ascending: false });

	const hasProjects = projects && projects.length > 0;

	return (
		<div>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">プロジェクト管理</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						案件やプロジェクトを管理します
					</p>
				</div>
				<CreateProjectDialog />
			</div>

			{hasProjects ? (
				<div className="mt-6 rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>プロジェクト名</TableHead>
								<TableHead>説明</TableHead>
								<TableHead>ステータス</TableHead>
								<TableHead>作成日</TableHead>
								<TableHead className="w-24">操作</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{projects.map((project) => (
								<ProjectRow key={project.id} project={project} />
							))}
						</TableBody>
					</Table>
				</div>
			) : (
				<div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
					<p className="text-muted-foreground">
						プロジェクトがまだ登録されていません
					</p>
					<div className="mt-4">
						<CreateProjectDialog />
					</div>
				</div>
			)}
		</div>
	);
}
