"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ACCOUNT_CATEGORIES } from "@/constants/accountCategories";
import type { ReceiptExtraction } from "@/types/receipt";

type Project = {
	id: string;
	name: string;
};

type ReceiptFormProps = {
	action: (
		prevState: { error: string | null },
		formData: FormData,
	) => Promise<{ error: string | null }>;
	projects: Project[];
	defaultValues?: Partial<ReceiptExtraction> & {
		projectId?: string | null;
		personInCharge?: string | null;
	};
	imageUrl?: string;
	imagePath?: string;
	aiRawResponse?: Record<string, unknown> | null;
	aiConfidence?: number | null;
	submitLabel: string;
	pendingLabel: string;
};

export function ReceiptForm({
	action,
	projects,
	defaultValues,
	imageUrl,
	imagePath,
	aiRawResponse,
	aiConfidence,
	submitLabel,
	pendingLabel,
}: ReceiptFormProps) {
	const [state, formAction, isPending] = useActionState(action, {
		error: null,
	});

	return (
		<form action={formAction} className="space-y-4">
			{imageUrl && <input type="hidden" name="imageUrl" value={imageUrl} />}
			{imagePath && <input type="hidden" name="imagePath" value={imagePath} />}
			{aiRawResponse && (
				<input
					type="hidden"
					name="aiRawResponse"
					value={JSON.stringify(aiRawResponse)}
				/>
			)}
			{aiConfidence != null && (
				<input type="hidden" name="aiConfidence" value={String(aiConfidence)} />
			)}

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="date">日付</Label>
					<Input
						id="date"
						name="date"
						type="date"
						defaultValue={defaultValues?.date ?? ""}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="payee">支払先</Label>
					<Input
						id="payee"
						name="payee"
						type="text"
						defaultValue={defaultValues?.payee ?? ""}
						placeholder="店舗名・会社名"
					/>
				</div>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="amount">金額（税込）</Label>
					<Input
						id="amount"
						name="amount"
						type="number"
						defaultValue={defaultValues?.amount ?? ""}
						placeholder="0"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="taxAmount">消費税額</Label>
					<Input
						id="taxAmount"
						name="taxAmount"
						type="number"
						defaultValue={defaultValues?.taxAmount ?? ""}
						placeholder="0"
					/>
				</div>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="taxRateCategory">税率区分</Label>
					<Select
						name="taxRateCategory"
						defaultValue={defaultValues?.taxRateCategory ?? ""}
					>
						<SelectTrigger id="taxRateCategory">
							<SelectValue placeholder="選択してください" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="10">標準税率 (10%)</SelectItem>
							<SelectItem value="8">軽減税率 (8%)</SelectItem>
							<SelectItem value="mixed">混在</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label htmlFor="accountCategory">勘定科目</Label>
					<Select
						name="accountCategory"
						defaultValue={defaultValues?.accountCategory ?? ""}
					>
						<SelectTrigger id="accountCategory">
							<SelectValue placeholder="選択してください" />
						</SelectTrigger>
						<SelectContent>
							{ACCOUNT_CATEGORIES.map((cat) => (
								<SelectItem key={cat.value} value={cat.value}>
									{cat.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className="space-y-2">
				<Label htmlFor="description">摘要・説明</Label>
				<Input
					id="description"
					name="description"
					type="text"
					defaultValue={defaultValues?.description ?? ""}
					placeholder="支出内容の説明"
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="invoiceRegistrationNo">インボイス登録番号</Label>
				<Input
					id="invoiceRegistrationNo"
					name="invoiceRegistrationNo"
					type="text"
					defaultValue={defaultValues?.invoiceRegistrationNo ?? ""}
					placeholder="T1234567890123"
				/>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="projectId">プロジェクト</Label>
					<Select
						name="projectId"
						defaultValue={defaultValues?.projectId ?? ""}
					>
						<SelectTrigger id="projectId">
							<SelectValue placeholder="選択してください" />
						</SelectTrigger>
						<SelectContent>
							{projects.map((project) => (
								<SelectItem key={project.id} value={project.id}>
									{project.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label htmlFor="personInCharge">担当者</Label>
					<Input
						id="personInCharge"
						name="personInCharge"
						type="text"
						defaultValue={defaultValues?.personInCharge ?? ""}
						placeholder="担当者名"
					/>
				</div>
			</div>

			{state.error && <p className="text-sm text-destructive">{state.error}</p>}

			<Button type="submit" className="w-full" disabled={isPending}>
				{isPending ? pendingLabel : submitLabel}
			</Button>
		</form>
	);
}
