"use client";

import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PAGE_PATH } from "@/constants/pagePath";
import { useAuth } from "@/contexts/AuthContext";
import {
	deleteStore,
	getStores,
	type Store,
	saveStore,
	updateStore,
} from "@/libs/storage";
import { formatDate } from "@/utils/formatDate";

export default function StoresPage() {
	const { tksUser } = useAuth();
	const [stores, setStores] = useState<Store[]>([]);
	const [createOpen, setCreateOpen] = useState(false);
	const [editTarget, setEditTarget] = useState<Store | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<Store | null>(null);
	const [error, setError] = useState<string | null>(null);

	const reload = useCallback(async () => setStores(await getStores()), []);

	useEffect(() => {
		reload();
	}, [reload]);

	if (tksUser?.role !== "hq_accountant") {
		return (
			<div className="py-12 text-center text-muted-foreground">
				本社経理のみアクセスできます
			</div>
		);
	}

	const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError(null);
		const fd = new FormData(e.currentTarget);
		try {
			await saveStore(fd.get("name") as string);
			setCreateOpen(false);
			await reload();
		} catch (err) {
			setError(err instanceof Error ? err.message : "作成に失敗しました");
		}
	};

	const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!editTarget) return;
		setError(null);
		const fd = new FormData(e.currentTarget);
		try {
			await updateStore(editTarget.id, { name: fd.get("name") as string });
			setEditTarget(null);
			await reload();
		} catch (err) {
			setError(err instanceof Error ? err.message : "更新に失敗しました");
		}
	};

	const handleDelete = async () => {
		if (!deleteTarget) return;
		setError(null);
		const ok = await deleteStore(deleteTarget.id);
		if (!ok) {
			setError(
				"削除に失敗しました（この店舗に紐づくユーザーやレシートがある可能性があります）",
			);
			return;
		}
		setDeleteTarget(null);
		await reload();
	};

	return (
		<div className="mx-auto max-w-3xl space-y-6">
			<div className="flex items-center gap-3">
				<Button
					render={<Link href={PAGE_PATH.settings} />}
					nativeButton={false}
					variant="ghost"
					size="icon"
				>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<h1 className="text-2xl font-bold">店舗管理</h1>
			</div>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle className="text-lg">店舗一覧</CardTitle>
					<Dialog
						open={createOpen}
						onOpenChange={(v) => {
							setCreateOpen(v);
							if (!v) setError(null);
						}}
					>
						<DialogTrigger render={<Button size="sm" />}>
							<Plus className="mr-1.5 h-4 w-4" />
							店舗追加
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>新しい店舗</DialogTitle>
							</DialogHeader>
							<form onSubmit={handleCreate} className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="create-name">店舗名</Label>
									<Input id="create-name" name="name" required />
								</div>
								{error && <p className="text-sm text-destructive">{error}</p>}
								<Button type="submit" className="w-full">
									作成
								</Button>
							</form>
						</DialogContent>
					</Dialog>
				</CardHeader>
				<CardContent>
					{stores.length > 0 ? (
						<div className="rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>店舗名</TableHead>
										<TableHead>作成日</TableHead>
										<TableHead className="w-24">操作</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{stores.map((s) => (
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
													<Button
														variant="ghost"
														size="icon"
														onClick={() => setDeleteTarget(s)}
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					) : (
						<p className="py-4 text-center text-sm text-muted-foreground">
							店舗が登録されていません
						</p>
					)}
				</CardContent>
			</Card>

			{/* 編集ダイアログ */}
			<Dialog
				open={editTarget !== null}
				onOpenChange={(v) => {
					if (!v) {
						setEditTarget(null);
						setError(null);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>店舗編集</DialogTitle>
					</DialogHeader>
					{editTarget && (
						<form onSubmit={handleEdit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="edit-name">店舗名</Label>
								<Input
									id="edit-name"
									name="name"
									defaultValue={editTarget.name}
									required
								/>
							</div>
							{error && <p className="text-sm text-destructive">{error}</p>}
							<Button type="submit" className="w-full">
								更新
							</Button>
						</form>
					)}
				</DialogContent>
			</Dialog>

			{/* 削除確認 */}
			<Dialog
				open={deleteTarget !== null}
				onOpenChange={(v) => {
					if (!v) {
						setDeleteTarget(null);
						setError(null);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>店舗を削除しますか？</DialogTitle>
						<DialogDescription>
							「{deleteTarget?.name}」を削除します。この操作は取り消せません。
						</DialogDescription>
					</DialogHeader>
					{error && <p className="text-sm text-destructive">{error}</p>}
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteTarget(null)}>
							キャンセル
						</Button>
						<Button variant="destructive" onClick={handleDelete}>
							削除する
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
