"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ACCOUNT_CATEGORIES } from "@/constants/accountCategories";
import { PAGE_PATH } from "@/constants/pagePath";
import { useAuth } from "@/contexts/AuthContext";
import {
	getReceipt,
	getStores,
	getTags,
	getTagsForReceipt,
	type Receipt,
	type Store,
	setReceiptTags,
	type Tag,
	updateReceipt,
} from "@/libs/storage";
import { TagPicker } from "../../components/TagPicker";

export default function EditReceiptPage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const { tksUser } = useAuth();
	const [receipt, setReceipt] = useState<Receipt | null>(null);
	const [stores, setStores] = useState<Store[]>([]);
	const [allTags, setAllTags] = useState<Tag[]>([]);
	const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		const myUserId = tksUser?.id ?? null;
		const myRole = tksUser?.role;
		const myStoreId = tksUser?.storeId ?? null;
		getReceipt(params.id).then((r) => {
			if (!r) {
				router.replace(PAGE_PATH.receipts);
				return;
			}
			if (myRole === "staff" && r.createdBy !== myUserId) {
				router.replace(PAGE_PATH.receipts);
				return;
			}
			if (myRole === "store_manager" && r.storeId !== myStoreId) {
				router.replace(PAGE_PATH.receipts);
				return;
			}
			setReceipt(r);
		});
		getStores().then(setStores);
		getTags().then(setAllTags);
		getTagsForReceipt(params.id).then(setSelectedTagIds);
	}, [params.id, router, tksUser?.id, tksUser?.role, tksUser?.storeId]);

	if (!receipt) return null;

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setIsSaving(true);
		const fd = new FormData(e.currentTarget);
		const amountStr = fd.get("amount") as string;
		const taxAmountStr = fd.get("taxAmount") as string;

		await updateReceipt(
			params.id,
			{
				date: (fd.get("date") as string) || null,
				payee: (fd.get("payee") as string) || null,
				amount: amountStr ? Number.parseInt(amountStr, 10) : null,
				taxAmount: taxAmountStr ? Number.parseInt(taxAmountStr, 10) : null,
				taxRateCategory:
					(fd.get("taxRateCategory") as "8" | "10" | "mixed") || null,
				accountCategory: (fd.get("accountCategory") as string) || null,
				description: (fd.get("description") as string) || null,
				invoiceRegistrationNo:
					(fd.get("invoiceRegistrationNo") as string) || null,
				storeId: (fd.get("storeId") as string) || null,
				purpose: (fd.get("purpose") as string) || null,
				participants: (fd.get("participants") as string) || null,
				isAiVerified: true,
			},
			tksUser?.id ?? null,
		);
		await setReceiptTags(params.id, selectedTagIds, tksUser?.id ?? null);

		window.location.href = PAGE_PATH.receiptDetail(params.id);
	};

	return (
		<div>
			<div className="mb-6 flex items-center gap-4">
				<Button
					render={<Link href={PAGE_PATH.receiptDetail(params.id)} />}
					nativeButton={false}
					variant="ghost"
					size="icon"
				>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<h1 className="text-2xl font-bold">レシート編集</h1>
			</div>

			<div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">レシート画像</CardTitle>
					</CardHeader>
					<CardContent>
						{/* biome-ignore lint/performance/noImgElement: base64 data URL */}
						<img
							src={receipt.imageUrl}
							alt="レシート"
							className="w-full rounded-lg border object-contain"
							style={{ maxHeight: "500px" }}
						/>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-lg">情報の編集</CardTitle>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="date">日付</Label>
									<Input
										id="date"
										name="date"
										type="date"
										defaultValue={receipt.date ?? ""}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="payee">支払先</Label>
									<Input
										id="payee"
										name="payee"
										defaultValue={receipt.payee ?? ""}
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
										defaultValue={receipt.amount ?? ""}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="taxAmount">消費税額</Label>
									<Input
										id="taxAmount"
										name="taxAmount"
										type="number"
										defaultValue={receipt.taxAmount ?? ""}
									/>
								</div>
							</div>
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="taxRateCategory">税率区分</Label>
									<Select
										name="taxRateCategory"
										defaultValue={receipt.taxRateCategory ?? ""}
									>
										<SelectTrigger id="taxRateCategory">
											<SelectValue placeholder="選択" />
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
										defaultValue={receipt.accountCategory ?? ""}
									>
										<SelectTrigger id="accountCategory">
											<SelectValue placeholder="選択" />
										</SelectTrigger>
										<SelectContent>
											{ACCOUNT_CATEGORIES.map((c) => (
												<SelectItem key={c.value} value={c.value}>
													{c.label}
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
									defaultValue={receipt.description ?? ""}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="invoiceRegistrationNo">
									インボイス登録番号
								</Label>
								<Input
									id="invoiceRegistrationNo"
									name="invoiceRegistrationNo"
									defaultValue={receipt.invoiceRegistrationNo ?? ""}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="storeId">店舗</Label>
								<NativeSelect
									id="storeId"
									name="storeId"
									defaultValue={receipt.storeId ?? ""}
									placeholder="選択"
									options={stores.map((s) => ({
										value: s.id,
										label: s.name,
									}))}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="purpose">目的</Label>
								<Input
									id="purpose"
									name="purpose"
									defaultValue={receipt.purpose ?? ""}
									placeholder="例: 顧客接待・社内会議など"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="participants">参加者</Label>
								<Input
									id="participants"
									name="participants"
									defaultValue={receipt.participants ?? ""}
									placeholder="例: 山田太郎、田中花子"
								/>
							</div>
							<div className="space-y-2">
								<Label>タグ</Label>
								<TagPicker
									allTags={allTags}
									selectedIds={selectedTagIds}
									onChange={setSelectedTagIds}
								/>
							</div>
							<Button type="submit" className="w-full" disabled={isSaving}>
								{isSaving ? "更新中..." : "更新する"}
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
