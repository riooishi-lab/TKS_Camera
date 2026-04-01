"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
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
import { TableCell, TableRow } from "@/components/ui/table";
import { formatDate } from "@/utils/formatDate";
import { deleteProject, updateProject } from "../actions/projectActions";

type Project = {
	id: string;
	name: string;
	description: string | null;
	is_active: boolean;
	created_at: string;
};

type ProjectRowProps = {
	project: Project;
};

export function ProjectRow({ project }: ProjectRowProps) {
	const [editOpen, setEditOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const boundUpdate = updateProject.bind(null, project.id);
	const [editState, editAction, isEditing] = useActionState(boundUpdate, {
		error: null,
	});

	useEffect(() => {
		if (!editState.error && !isEditing && editOpen) {
			setEditOpen(false);
		}
	}, [editState, isEditing, editOpen]);

	const handleDelete = async () => {
		setIsDeleting(true);
		await deleteProject(project.id);
		setDeleteOpen(false);
		setIsDeleting(false);
	};

	return (
		<TableRow>
			<TableCell className="font-medium">{project.name}</TableCell>
			<TableCell>{project.description ?? "-"}</TableCell>
			<TableCell>
				{project.is_active ? (
					<Badge variant="default">有効</Badge>
				) : (
					<Badge variant="secondary">無効</Badge>
				)}
			</TableCell>
			<TableCell>{formatDate(project.created_at)}</TableCell>
			<TableCell>
				<div className="flex gap-1">
					{/* 編集ダイアログ */}
					<Dialog open={editOpen} onOpenChange={setEditOpen}>
						<DialogTrigger render={<Button variant="ghost" size="icon" />}>
							<Pencil className="h-4 w-4" />
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>プロジェクト編集</DialogTitle>
							</DialogHeader>
							<form action={editAction} className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor={`name-${project.id}`}>プロジェクト名</Label>
									<Input
										id={`name-${project.id}`}
										name="name"
										type="text"
										defaultValue={project.name}
										required
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor={`desc-${project.id}`}>説明（任意）</Label>
									<Input
										id={`desc-${project.id}`}
										name="description"
										type="text"
										defaultValue={project.description ?? ""}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor={`active-${project.id}`}>ステータス</Label>
									<Select
										name="isActive"
										defaultValue={String(project.is_active)}
									>
										<SelectTrigger id={`active-${project.id}`}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="true">有効</SelectItem>
											<SelectItem value="false">無効</SelectItem>
										</SelectContent>
									</Select>
								</div>
								{editState.error && (
									<p className="text-sm text-destructive">{editState.error}</p>
								)}
								<Button type="submit" className="w-full" disabled={isEditing}>
									{isEditing ? "更新中..." : "更新"}
								</Button>
							</form>
						</DialogContent>
					</Dialog>

					{/* 削除ダイアログ */}
					<Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
						<DialogTrigger render={<Button variant="ghost" size="icon" />}>
							<Trash2 className="h-4 w-4" />
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>プロジェクトを削除しますか？</DialogTitle>
								<DialogDescription>
									「{project.name}
									」を削除します。関連するレシートのプロジェクト紐付けは解除されません。
								</DialogDescription>
							</DialogHeader>
							<DialogFooter>
								<Button variant="outline" onClick={() => setDeleteOpen(false)}>
									キャンセル
								</Button>
								<Button
									variant="destructive"
									onClick={handleDelete}
									disabled={isDeleting}
								>
									{isDeleting ? "削除中..." : "削除する"}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>
			</TableCell>
		</TableRow>
	);
}
