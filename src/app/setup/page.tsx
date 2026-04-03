"use client";

import { updatePassword } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { updateUser } from "@/libs/storage";

export default function SetupPage() {
	const router = useRouter();
	const { firebaseUser, tksUser, loading, needsSetup, refreshUser } =
		useAuth();
	const [name, setName] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!loading && !firebaseUser) {
			router.replace("/login");
		}
		if (!loading && tksUser && !needsSetup) {
			router.replace("/receipts");
		}
	}, [loading, firebaseUser, tksUser, needsSetup, router]);

	if (loading || !firebaseUser || !tksUser) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setSubmitting(true);

		try {
			if (newPassword) {
				if (newPassword.length < 6) {
					setError("パスワードは6文字以上で入力してください");
					setSubmitting(false);
					return;
				}
				await updatePassword(firebaseUser, newPassword);
			}

			await updateUser(tksUser.id, { name });
			await refreshUser();
			router.replace("/receipts");
		} catch (err) {
			const msg = err instanceof Error ? err.message : "エラーが発生しました";
			setError(msg);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center px-4">
			<Card className="w-full max-w-sm">
				<CardHeader className="text-center">
					<CardTitle>初回セットアップ</CardTitle>
					<p className="text-sm text-muted-foreground">
						名前とパスワードを設定してください
					</p>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="name">名前</Label>
							<Input
								id="name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								placeholder="例: 山田太郎"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="newPassword">新しいパスワード</Label>
							<Input
								id="newPassword"
								type="password"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								placeholder="6文字以上（変更しない場合は空欄）"
								autoComplete="new-password"
							/>
						</div>
						{error && <p className="text-sm text-destructive">{error}</p>}
						<Button type="submit" className="w-full" disabled={submitting}>
							{submitting ? "設定中..." : "設定を完了"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
