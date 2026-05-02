"use client";

import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { NativeSelect } from "@/components/ui/native-select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import {
	createUser,
	deleteUser,
	getStores,
	getUsers,
	type Store,
	type TksUser,
	type UserRole,
	updateUser,
} from "@/libs/storage";

const ROLE_LABELS: Record<UserRole, string> = {
	staff: "スタッフ",
	store_manager: "店舗管理者",
	hq_accountant: "本社経理",
	president: "社長",
};

export default function UsersPage() {
	const { tksUser } = useAuth();
	const [users, setUsers] = useState<TksUser[]>([]);
	const [stores, setStores] = useState<Store[]>([]);
	const [open, setOpen] = useState(false);
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<UserRole>("staff");
	const [storeId, setStoreId] = useState("");
	const [error, setError] = useState("");
	const [inviteLink, setInviteLink] = useState("");
	const [copied, setCopied] = useState(false);

	const load = useCallback(() => {
		getUsers().then(setUsers);
		getStores().then(setStores);
	}, []);
	useEffect(() => {
		load();
	}, [load]);

	if (tksUser?.role !== "hq_accountant") {
		return (
			<div className="py-12 text-center text-muted-foreground">
				本社経理のみアクセスできます
			</div>
		);
	}

	const storeName = (id: string | null) =>
		id ? (stores.find((s) => s.id === id)?.name ?? "-") : "-";

	const handleInvite = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setInviteLink("");

		try {
			const inviteCode = crypto.randomUUID();
			await createUser({
				email,
				role,
				storeId: storeId || null,
				inviteCode,
				invitedBy: tksUser.id,
			});
			const base = window.location.origin;
			setInviteLink(`${base}/register?code=${inviteCode}`);
			setEmail("");
			setStoreId("");
			load();
		} catch (err) {
			const msg = err instanceof Error ? err.message : "エラーが発生しました";
			if (msg.includes("duplicate") || msg.includes("unique")) {
				setError("このメールアドレスは既に登録されています");
			} else {
				setError(msg);
			}
		}
	};

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(inviteLink);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			setError("クリップボードへのコピーに失敗しました");
		}
	};

	const handleRoleChange = async (id: string, newRole: UserRole) => {
		try {
			await updateUser(id, { role: newRole });
			load();
		} catch {
			setError("権限の変更に失敗しました");
		}
	};

	const handleStoreChange = async (id: string, newStoreId: string) => {
		try {
			await updateUser(id, { storeId: newStoreId || null });
			load();
		} catch {
			setError("店舗の変更に失敗しました");
		}
	};

	const handleDelete = async (id: string) => {
		try {
			await deleteUser(id);
			load();
		} catch {
			setError("ユーザーの削除に失敗しました");
		}
	};

	return (
		<div>
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">ユーザー管理</h1>
				<Dialog
					open={open}
					onOpenChange={(v) => {
						setOpen(v);
						if (!v) {
							setInviteLink("");
							setError("");
						}
					}}
				>
					<DialogTrigger render={<Button />}>
						<Plus className="mr-2 h-4 w-4" />
						ユーザー招待
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>ユーザーを招待</DialogTitle>
						</DialogHeader>
						<form onSubmit={handleInvite} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="inviteEmail">メールアドレス</Label>
								<Input
									id="inviteEmail"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="inviteRole">権限</Label>
								<select
									id="inviteRole"
									value={role}
									onChange={(e) => setRole(e.target.value as UserRole)}
									className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
								>
									<option value="staff">{ROLE_LABELS.staff}</option>
									<option value="store_manager">
										{ROLE_LABELS.store_manager}
									</option>
									<option value="hq_accountant">
										{ROLE_LABELS.hq_accountant}
									</option>
									<option value="president">{ROLE_LABELS.president}</option>
								</select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="inviteStore">店舗（任意）</Label>
								<NativeSelect
									id="inviteStore"
									value={storeId}
									onChange={(e) => setStoreId(e.target.value)}
									placeholder="選択"
									options={stores.map((s) => ({ value: s.id, label: s.name }))}
								/>
							</div>
							{error && <p className="text-sm text-destructive">{error}</p>}
							<Button type="submit" className="w-full">
								招待リンクを生成
							</Button>
						</form>
						{inviteLink && (
							<div className="mt-4 space-y-2">
								<Label>招待リンク</Label>
								<div className="flex items-center gap-2">
									<Input value={inviteLink} readOnly className="text-xs" />
									<Button variant="outline" size="icon" onClick={handleCopy}>
										{copied ? (
											<Check className="h-4 w-4" />
										) : (
											<Copy className="h-4 w-4" />
										)}
									</Button>
								</div>
								<p className="text-xs text-muted-foreground">
									このリンクを招待する方に共有してください
								</p>
							</div>
						)}
					</DialogContent>
				</Dialog>
			</div>

			<div className="mt-6 rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>名前</TableHead>
							<TableHead>メール</TableHead>
							<TableHead>権限</TableHead>
							<TableHead>店舗</TableHead>
							<TableHead>状態</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{users.map((u) => (
							<TableRow key={u.id}>
								<TableCell>{u.name ?? "-"}</TableCell>
								<TableCell className="text-xs">{u.email}</TableCell>
								<TableCell>
									{u.id === tksUser.id ? (
										<Badge>{ROLE_LABELS[u.role]}</Badge>
									) : (
										<select
											value={u.role}
											onChange={(e) =>
												handleRoleChange(u.id, e.target.value as UserRole)
											}
											className="h-7 rounded border border-input bg-transparent px-1.5 text-xs outline-none"
										>
											<option value="staff">{ROLE_LABELS.staff}</option>
											<option value="store_manager">
												{ROLE_LABELS.store_manager}
											</option>
											<option value="hq_accountant">
												{ROLE_LABELS.hq_accountant}
											</option>
											<option value="president">{ROLE_LABELS.president}</option>
										</select>
									)}
								</TableCell>
								<TableCell>
									{u.id === tksUser.id ? (
										storeName(u.storeId)
									) : (
										<select
											value={u.storeId ?? ""}
											onChange={(e) => handleStoreChange(u.id, e.target.value)}
											className="h-7 rounded border border-input bg-transparent px-1.5 text-xs outline-none"
										>
											<option value="">未割当</option>
											{stores.map((s) => (
												<option key={s.id} value={s.id}>
													{s.name}
												</option>
											))}
										</select>
									)}
								</TableCell>
								<TableCell>
									{u.status === "active" ? (
										<Badge variant="default">有効</Badge>
									) : (
										<Badge variant="secondary">招待中</Badge>
									)}
								</TableCell>
								<TableCell>
									{u.id !== tksUser.id && (
										<Dialog>
											<DialogTrigger
												render={<Button variant="ghost" size="icon" />}
											>
												<Trash2 className="h-4 w-4" />
											</DialogTrigger>
											<DialogContent>
												<DialogHeader>
													<DialogTitle>ユーザーを削除しますか？</DialogTitle>
													<DialogDescription>
														{u.name ?? u.email}
														を削除します。この操作は取り消せません。
													</DialogDescription>
												</DialogHeader>
												<DialogFooter>
													<Button
														variant="destructive"
														onClick={() => handleDelete(u.id)}
													>
														削除する
													</Button>
												</DialogFooter>
											</DialogContent>
										</Dialog>
									)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
