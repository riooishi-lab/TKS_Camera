"use client";

import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PAGE_PATH } from "@/constants/pagePath";
import { useAuth } from "@/contexts/AuthContext";
import {
	deleteTag,
	getTags,
	saveTag,
	type Tag,
	updateTag,
} from "@/libs/storage";

const DEFAULT_COLORS = [
	"#ef4444",
	"#f97316",
	"#eab308",
	"#22c55e",
	"#06b6d4",
	"#3b82f6",
	"#8b5cf6",
	"#ec4899",
];

function TagForm({
	initial,
	onSubmit,
	submitLabel,
}: {
	initial?: Tag;
	onSubmit: (name: string, color: string | null) => Promise<void>;
	submitLabel: string;
}) {
	const [name, setName] = useState(initial?.name ?? "");
	const [color, setColor] = useState(initial?.color ?? DEFAULT_COLORS[0]);
	const [saving, setSaving] = useState(false);
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;
		setSaving(true);
		try {
			await onSubmit(name.trim(), color);
		} finally {
			setSaving(false);
		}
	};
	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="tag-name">タグ名</Label>
				<Input
					id="tag-name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="例: 出張, 接待"
					autoFocus
				/>
			</div>
			<div className="space-y-2">
				<Label>色</Label>
				<div className="flex flex-wrap gap-2">
					{DEFAULT_COLORS.map((c) => (
						<button
							key={c}
							type="button"
							onClick={() => setColor(c)}
							className={`h-7 w-7 rounded-full border-2 transition-transform ${
								color === c
									? "scale-110 border-foreground"
									: "border-transparent"
							}`}
							style={{ backgroundColor: c }}
							aria-label={c}
						/>
					))}
				</div>
			</div>
			<DialogFooter>
				<Button type="submit" disabled={saving || !name.trim()}>
					{saving ? "保存中..." : submitLabel}
				</Button>
			</DialogFooter>
		</form>
	);
}

export default function TagsPage() {
	const { tksUser } = useAuth();
	const canEdit =
		tksUser?.role === "hq_accountant" || tksUser?.role === "store_manager";
	const [tags, setTags] = useState<Tag[]>([]);
	const [createOpen, setCreateOpen] = useState(false);
	const [editTarget, setEditTarget] = useState<Tag | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);

	const refresh = useCallback(() => getTags().then(setTags), []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	if (tksUser?.role === "staff") {
		return (
			<div className="py-12 text-center text-muted-foreground">
				このページにはアクセスできません
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<div className="flex items-center gap-3">
				<Button
					render={<Link href={PAGE_PATH.settings} />}
					nativeButton={false}
					variant="ghost"
					size="icon"
				>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<h1 className="text-2xl font-bold">タグ管理</h1>
			</div>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle className="text-lg">タグ一覧</CardTitle>
					{canEdit && (
						<Dialog open={createOpen} onOpenChange={setCreateOpen}>
							<DialogTrigger render={<Button size="sm" />}>
								<Plus className="mr-1.5 h-4 w-4" />
								追加
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>タグを追加</DialogTitle>
								</DialogHeader>
								<TagForm
									submitLabel="追加"
									onSubmit={async (name, color) => {
										await saveTag(name, color);
										setCreateOpen(false);
										await refresh();
									}}
								/>
							</DialogContent>
						</Dialog>
					)}
				</CardHeader>
				<CardContent>
					{tags.length === 0 ? (
						<p className="py-4 text-center text-sm text-muted-foreground">
							タグがまだ登録されていません
						</p>
					) : (
						<ul className="divide-y">
							{tags.map((tag) => (
								<li
									key={tag.id}
									className="flex items-center justify-between py-2"
								>
									<div className="flex items-center gap-2">
										{tag.color && (
											<span
												className="inline-block h-3 w-3 rounded-full"
												style={{ backgroundColor: tag.color }}
											/>
										)}
										<span className="font-medium">{tag.name}</span>
									</div>
									{canEdit && (
										<div className="flex gap-1">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setEditTarget(tag)}
											>
												<Pencil className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setDeleteTarget(tag)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									)}
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>

			<Dialog
				open={editTarget !== null}
				onOpenChange={(o) => !o && setEditTarget(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>タグを編集</DialogTitle>
					</DialogHeader>
					{editTarget && (
						<TagForm
							initial={editTarget}
							submitLabel="更新"
							onSubmit={async (name, color) => {
								await updateTag(editTarget.id, { name, color });
								setEditTarget(null);
								await refresh();
							}}
						/>
					)}
				</DialogContent>
			</Dialog>

			<Dialog
				open={deleteTarget !== null}
				onOpenChange={(o) => !o && setDeleteTarget(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							タグ「{deleteTarget?.name}」を削除しますか？
						</DialogTitle>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="destructive"
							onClick={async () => {
								if (!deleteTarget) return;
								await deleteTag(deleteTarget.id);
								setDeleteTarget(null);
								await refresh();
							}}
						>
							削除する
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
