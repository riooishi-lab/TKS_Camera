"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	deleteStaff,
	getStaff,
	type Staff,
	saveStaff,
	updateStaff,
} from "@/libs/storage";
import { formatDate } from "@/utils/formatDate";

export default function StaffPage() {
	const [staffList, setStaffList] = useState<Staff[]>([]);
	const [createOpen, setCreateOpen] = useState(false);
	const [editTarget, setEditTarget] = useState<Staff | null>(null);

	const reload = useCallback(async () => setStaffList(await getStaff()), []);

	useEffect(() => {
		reload();
	}, [reload]);

	const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		await saveStaff(fd.get("name") as string);
		setCreateOpen(false);
		await reload();
	};

	const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!editTarget) return;
		const fd = new FormData(e.currentTarget);
		await updateStaff(editTarget.id, { name: fd.get("name") as string });
		setEditTarget(null);
		await reload();
	};

	const handleDelete = async (id: string) => {
		await deleteStaff(id);
		await reload();
	};

	return (
		<div>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">担当者</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						担当者を管理します
					</p>
				</div>
				<Dialog open={createOpen} onOpenChange={setCreateOpen}>
					<DialogTrigger render={<Button />}>
						<Plus className="mr-2 h-4 w-4" />
						担当者を追加
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>新しい担当者</DialogTitle>
						</DialogHeader>
						<form onSubmit={handleCreate} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="create-name">担当者名</Label>
								<Input id="create-name" name="name" required />
							</div>
							<Button type="submit" className="w-full">
								追加
							</Button>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			{staffList.length > 0 ? (
				<div className="mt-6 rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>担当者名</TableHead>
								<TableHead>登録日</TableHead>
								<TableHead className="w-24">操作</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{staffList.map((s) => (
								<TableRow key={s.id}>
									<TableCell className="font-medium">{s.name}</TableCell>
									<TableCell>{formatDate(s.createdAt)}</TableCell>
									<TableCell>
										<div className="flex gap-1">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setEditTarget(s)}
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
														<DialogTitle>担当者を削除しますか？</DialogTitle>
														<DialogDescription>
															「{s.name}」を削除します。
														</DialogDescription>
													</DialogHeader>
													<DialogFooter>
														<Button
															variant="destructive"
															onClick={() => handleDelete(s.id)}
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
						担当者がまだ登録されていません
					</p>
				</div>
			)}

			<Dialog
				open={editTarget !== null}
				onOpenChange={(open) => !open && setEditTarget(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>担当者の編集</DialogTitle>
					</DialogHeader>
					{editTarget && (
						<form onSubmit={handleEdit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="edit-name">担当者名</Label>
								<Input
									id="edit-name"
									name="name"
									defaultValue={editTarget.name}
									required
								/>
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
