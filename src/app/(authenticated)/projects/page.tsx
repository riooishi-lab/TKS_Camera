"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	type Project,
	deleteProject,
	getProjects,
	saveProject,
	updateProject,
} from "@/libs/storage";
import { formatDate } from "@/utils/formatDate";

export default function ProjectsPage() {
	const [projects, setProjects] = useState<Project[]>([]);
	const [createOpen, setCreateOpen] = useState(false);
	const [editTarget, setEditTarget] = useState<Project | null>(null);

	useEffect(() => {
		setProjects(getProjects());
	}, []);

	const reload = () => setProjects(getProjects());

	const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		saveProject(
			fd.get("name") as string,
			(fd.get("description") as string) || null,
		);
		setCreateOpen(false);
		reload();
	};

	const handleEdit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!editTarget) return;
		const fd = new FormData(e.currentTarget);
		updateProject(editTarget.id, {
			name: fd.get("name") as string,
			description: (fd.get("description") as string) || null,
			isActive: fd.get("isActive") === "true",
		});
		setEditTarget(null);
		reload();
	};

	const handleDelete = (id: string) => {
		deleteProject(id);
		reload();
	};

	return (
		<div>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">プロジェクト管理</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						案件やプロジェクトを管理します
					</p>
				</div>
				<Dialog open={createOpen} onOpenChange={setCreateOpen}>
					<DialogTrigger render={<Button />}>
						<Plus className="mr-2 h-4 w-4" />
						プロジェクト作成
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>新しいプロジェクト</DialogTitle>
						</DialogHeader>
						<form onSubmit={handleCreate} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="create-name">プロジェクト名</Label>
								<Input id="create-name" name="name" required />
							</div>
							<div className="space-y-2">
								<Label htmlFor="create-desc">説明（任意）</Label>
								<Input id="create-desc" name="description" />
							</div>
							<Button type="submit" className="w-full">
								作成
							</Button>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			{projects.length > 0 ? (
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
							{projects.map((p) => (
								<TableRow key={p.id}>
									<TableCell className="font-medium">{p.name}</TableCell>
									<TableCell>{p.description ?? "-"}</TableCell>
									<TableCell>
										{p.isActive ? (
											<Badge variant="default">有効</Badge>
										) : (
											<Badge variant="secondary">無効</Badge>
										)}
									</TableCell>
									<TableCell>{formatDate(p.createdAt)}</TableCell>
									<TableCell>
										<div className="flex gap-1">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setEditTarget(p)}
											>
												<Pencil className="h-4 w-4" />
											</Button>
											<Dialog>
												<DialogTrigger
													render={<Button variant="ghost" size="icon" />}
												>
													<Trash2 className="h-4 w-4" />
												</DialogTrigger>
												<DialogContent>
													<DialogHeader>
														<DialogTitle>
															プロジェクトを削除しますか？
														</DialogTitle>
														<DialogDescription>
															「{p.name}」を削除します。
														</DialogDescription>
													</DialogHeader>
													<DialogFooter>
														<Button
															variant="destructive"
															onClick={() => handleDelete(p.id)}
														>
															削除する
														</Button>
													</DialogFooter>
												</DialogContent>
											</Dialog>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			) : (
				<div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
					<p className="text-muted-foreground">
						プロジェクトがまだ登録されていません
					</p>
				</div>
			)}

			{/* 編集ダイアログ */}
			<Dialog
				open={editTarget !== null}
				onOpenChange={(open) => !open && setEditTarget(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>プロジェクト編集</DialogTitle>
					</DialogHeader>
					{editTarget && (
						<form onSubmit={handleEdit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="edit-name">プロジェクト名</Label>
								<Input
									id="edit-name"
									name="name"
									defaultValue={editTarget.name}
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="edit-desc">説明（任意）</Label>
								<Input
									id="edit-desc"
									name="description"
									defaultValue={editTarget.description ?? ""}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="edit-active">ステータス</Label>
								<Select
									name="isActive"
									defaultValue={String(editTarget.isActive)}
								>
									<SelectTrigger id="edit-active">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="true">有効</SelectItem>
										<SelectItem value="false">無効</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<Button type="submit" className="w-full">
								更新
							</Button>
						</form>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
