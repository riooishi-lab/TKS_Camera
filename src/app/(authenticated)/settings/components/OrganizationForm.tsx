"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrganization } from "../actions/settingsActions";

type OrganizationFormProps = {
	name: string;
	isAdmin: boolean;
};

export function OrganizationForm({ name, isAdmin }: OrganizationFormProps) {
	const [state, formAction, isPending] = useActionState(updateOrganization, {
		error: null,
	});

	return (
		<form action={formAction} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="orgName">組織名</Label>
				<Input
					id="orgName"
					name="name"
					type="text"
					defaultValue={name}
					disabled={!isAdmin}
					required
				/>
			</div>
			{state.error && <p className="text-sm text-destructive">{state.error}</p>}
			{state.success && <p className="text-sm text-green-600">更新しました</p>}
			{isAdmin && (
				<Button type="submit" disabled={isPending}>
					{isPending ? "更新中..." : "組織名を更新"}
				</Button>
			)}
		</form>
	);
}
