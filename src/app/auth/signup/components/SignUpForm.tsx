"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp } from "../actions/signUp";

export function SignUpForm() {
	const [state, formAction, isPending] = useActionState(signUp, {
		error: null,
	});

	return (
		<form action={formAction} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="organizationName">組織名</Label>
				<Input
					id="organizationName"
					name="organizationName"
					type="text"
					placeholder="株式会社〇〇"
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="displayName">表示名</Label>
				<Input
					id="displayName"
					name="displayName"
					type="text"
					placeholder="山田太郎"
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="email">メールアドレス</Label>
				<Input
					id="email"
					name="email"
					type="email"
					placeholder="your@email.com"
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="password">パスワード</Label>
				<Input
					id="password"
					name="password"
					type="password"
					placeholder="6文字以上"
					minLength={6}
					required
				/>
			</div>
			{state.error && <p className="text-sm text-destructive">{state.error}</p>}
			<Button type="submit" className="w-full" disabled={isPending}>
				{isPending ? "作成中..." : "アカウントを作成"}
			</Button>
		</form>
	);
}
