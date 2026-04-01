"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "../actions/signIn";

export function SignInForm() {
	const [state, formAction, isPending] = useActionState(signIn, {
		error: null,
	});

	return (
		<form action={formAction} className="space-y-4">
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
				<Input id="password" name="password" type="password" required />
			</div>
			{state.error && <p className="text-sm text-destructive">{state.error}</p>}
			<Button type="submit" className="w-full" disabled={isPending}>
				{isPending ? "ログイン中..." : "ログイン"}
			</Button>
		</form>
	);
}
