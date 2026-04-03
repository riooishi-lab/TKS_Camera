"use client";

import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
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
import { useAuth } from "@/contexts/AuthContext";
import {
	type TksUser,
	type UserRole,
	createUser,
	deleteUser,
	getUsers,
	updateUser,
} from "@/libs/storage";

const ROLE_LABELS: Record<UserRole, string> = {
	admin: "管理者",
	editor: "登録者",
	viewer: "閲覧者",
};

export default function UsersPage() {
	const { tksUser } = useAuth();
	const [users, setUsers] = useState<TksUser[]>([]);
	const [open, setOpen] = useState(false);
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<UserRole>("editor");
	const [error, setError] = useState("");
	const [inviteLink, setInviteLink] = useState("");
	const [copied, setCopied] = useState(false);

	const load = () => getUsers().then(setUsers);
	useEffect(() => {
		load();
	}, []);

	if (tksUser?.role !== "admin") {
		return (
			<div className="py-12 text-center text-muted-foreground">
				管理者のみアクセスできます
			</div>
		);
	}

	const handleInvite = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setInviteLink("");

		try {
			const inviteCode = crypto.randomUUID();
			await createUser({
				email,
				role,
				inviteCode,
				invitedBy: tksUser.id,
			});
			const base = window.location.origin;
			setInviteLink(`${base}/register?code=${inviteCode}`);
			setEmail("");
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
		await navigator.clipboard.writeText(inviteLink);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleRoleChange = async (id: string, newRole: UserRole) => {
		await updateUser(id, { role: newRole });
		load();
	};

	const handleDelete = async (id: string, name: string | null) => {
		if (!confirm(`${name ?? "このユーザー"}を削除しますか？`)) return;
		await deleteUser(id);
		load();
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
					<DialogTrigger
						render={<Button />}
					>
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
									<option value="admin">管理者</option>
									<option value="editor">登録者</option>
									<option value="viewer">閲覧者</option>
								</select>
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
									<Button
										variant="outline"
										size="icon"
										onClick={handleCopy}
									>
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
											<option value="admin">管理者</option>
											<option value="editor">登録者</option>
											<option value="viewer">閲覧者</option>
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
										<Button
											variant="ghost"
											size="icon"
											onClick={() => handleDelete(u.id, u.name)}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
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
