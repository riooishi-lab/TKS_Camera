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
	type Client,
	deleteClient,
	getClients,
	saveClient,
	updateClient,
} from "@/libs/storage";
import { formatDate } from "@/utils/formatDate";

export default function ClientsPage() {
	const [clients, setClients] = useState<Client[]>([]);
	const [createOpen, setCreateOpen] = useState(false);
	const [editTarget, setEditTarget] = useState<Client | null>(null);

	const reload = useCallback(async () => setClients(await getClients()), []);

	useEffect(() => {
		reload();
	}, [reload]);

	const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		await saveClient(fd.get("name") as string);
		setCreateOpen(false);
		await reload();
	};

	const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!editTarget) return;
		const fd = new FormData(e.currentTarget);
		await updateClient(editTarget.id, { name: fd.get("name") as string });
		setEditTarget(null);
		await reload();
	};

	const handleDelete = async (id: string) => {
		await deleteClient(id);
		await reload();
	};

	return (
		<div>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">顧客企業</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						取引先の企業を管理します
					</p>
				</div>
				<Dialog open={createOpen} onOpenChange={setCreateOpen}>
					<DialogTrigger render={<Button />}>
						<Plus className="mr-2 h-4 w-4" />
						企業を追加
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>新しい企業</DialogTitle>
						</DialogHeader>
						<form onSubmit={handleCreate} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="create-name">企業名</Label>
								<Input id="create-name" name="name" required />
							</div>
							<Button type="submit" className="w-full">
								追加
							</Button>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			{clients.length > 0 ? (
				<div className="mt-6 rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>企業名</TableHead>
								<TableHead>登録日</TableHead>
								<TableHead className="w-24">操作</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{clients.map((c) => (
								<TableRow key={c.id}>
									<TableCell className="font-medium">{c.name}</TableCell>
									<TableCell>{formatDate(c.createdAt)}</TableCell>
									<TableCell>
										<div className="flex gap-1">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setEditTarget(c)}
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
														<DialogTitle>企業を削除しますか？</DialogTitle>
														<DialogDescription>
															「{c.name}」を削除します。
														</DialogDescription>
													</DialogHeader>
													<DialogFooter>
														<Button
															variant="destructive"
															onClick={() => handleDelete(c.id)}
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
					<p className="text-muted-foreground">企業がまだ登録されていません</p>
				</div>
			)}

			<Dialog
				open={editTarget !== null}
				onOpenChange={(open) => !open && setEditTarget(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>企業の編集</DialogTitle>
					</DialogHeader>
					{editTarget && (
						<form onSubmit={handleEdit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="edit-name">企業名</Label>
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
