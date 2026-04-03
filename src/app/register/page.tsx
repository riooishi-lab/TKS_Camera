"use client";

import { createUserWithEmailAndPassword } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFirebaseAuth } from "@/libs/firebase";
import { getUserByInviteCode, type TksUser, updateUser } from "@/libs/storage";

function RegisterForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const code = searchParams.get("code") ?? "";

	const [invite, setInvite] = useState<TksUser | null>(null);
	const [loadingInvite, setLoadingInvite] = useState(true);
	const [invalid, setInvalid] = useState(false);

	const [name, setName] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!code) {
			setInvalid(true);
			setLoadingInvite(false);
			return;
		}
		getUserByInviteCode(code).then((user) => {
			if (user) {
				setInvite(user);
			} else {
				setInvalid(true);
			}
			setLoadingInvite(false);
		});
	}, [code]);

	if (loadingInvite) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (invalid || !invite) {
		return (
			<div className="flex min-h-screen items-center justify-center px-4">
				<Card className="w-full max-w-sm">
					<CardContent className="pt-6 text-center">
						<p className="text-destructive">
							無効な招待リンクです。管理者にお問い合わせください。
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (password.length < 6) {
			setError("パスワードは6文字以上で入力してください");
			return;
		}

		setSubmitting(true);
		try {
			const auth = getFirebaseAuth();
			const cred = await createUserWithEmailAndPassword(
				auth,
				invite.email,
				password,
			);

			await updateUser(invite.id, {
				firebaseUid: cred.user.uid,
				name,
				status: "active",
			});

			router.replace("/receipts");
		} catch (err) {
			const msg = err instanceof Error ? err.message : "エラーが発生しました";
			if (msg.includes("email-already-in-use")) {
				setError("このメールアドレスは既に登録済みです");
			} else {
				setError(msg);
			}
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center px-4">
			<Card className="w-full max-w-sm">
				<CardHeader className="text-center">
					<CardTitle>アカウント登録</CardTitle>
					<p className="text-sm text-muted-foreground">
						招待されたアカウントの設定を行います
					</p>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label>メールアドレス</Label>
							<Input value={invite.email} disabled />
						</div>
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
							<Label htmlFor="password">パスワード</Label>
							<Input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								placeholder="6文字以上"
								autoComplete="new-password"
							/>
						</div>
						{error && <p className="text-sm text-destructive">{error}</p>}
						<Button type="submit" className="w-full" disabled={submitting}>
							{submitting ? "登録中..." : "登録"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}

export default function RegisterPage() {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-screen items-center justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			}
		>
			<RegisterForm />
		</Suspense>
	);
}
