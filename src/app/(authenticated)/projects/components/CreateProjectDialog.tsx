"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
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
import { createProject } from "../actions/projectActions";

export function CreateProjectDialog() {
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(createProject, {
		error: null,
	});

	useEffect(() => {
		if (!state.error && !isPending && open) {
			setOpen(false);
		}
	}, [state, isPending, open]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button />}>
				<Plus className="mr-2 h-4 w-4" />
				プロジェクト作成
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>新しいプロジェクト</DialogTitle>
				</DialogHeader>
				<form action={formAction} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="name">プロジェクト名</Label>
						<Input
							id="name"
							name="name"
							type="text"
							placeholder="プロジェクト名を入力"
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="description">説明（任意）</Label>
						<Input
							id="description"
							name="description"
							type="text"
							placeholder="プロジェクトの説明"
						/>
					</div>
					{state.error && (
						<p className="text-sm text-destructive">{state.error}</p>
					)}
					<Button type="submit" className="w-full" disabled={isPending}>
						{isPending ? "作成中..." : "作成"}
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}
