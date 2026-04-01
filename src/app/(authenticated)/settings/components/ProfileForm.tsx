"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "../actions/settingsActions";

type ProfileFormProps = {
	displayName: string;
	email: string;
};

export function ProfileForm({ displayName, email }: ProfileFormProps) {
	const [state, formAction, isPending] = useActionState(updateProfile, {
		error: null,
	});

	return (
		<form action={formAction} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="email">メールアドレス</Label>
				<Input id="email" type="email" value={email} disabled />
			</div>
			<div className="space-y-2">
				<Label htmlFor="displayName">表示名</Label>
				<Input
					id="displayName"
					name="displayName"
					type="text"
					defaultValue={displayName}
					required
				/>
			</div>
			{state.error && <p className="text-sm text-destructive">{state.error}</p>}
			{state.success && <p className="text-sm text-green-600">更新しました</p>}
			<Button type="submit" disabled={isPending}>
				{isPending ? "更新中..." : "プロフィールを更新"}
			</Button>
		</form>
	);
}
