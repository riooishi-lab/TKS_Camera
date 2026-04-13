"use client";

import { ArrowLeft, CheckCircle, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { PAGE_PATH } from "@/constants/pagePath";
import { useAuth } from "@/contexts/AuthContext";
import {
	deleteReceipt,
	getReceipt,
	getTags,
	getTagsForReceipt,
	type Receipt,
	type Tag,
	updateReceipt,
} from "@/libs/storage";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { AuditLogList } from "../components/AuditLogList";
import { TagBadges } from "../components/TagPicker";

export default function ReceiptDetailPage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const { tksUser } = useAuth();
	const [receipt, setReceipt] = useState<Receipt | null>(null);
	const [tags, setTags] = useState<Tag[]>([]);
	const [tagIds, setTagIds] = useState<string[]>([]);
	const isAdmin = tksUser?.role === "admin";
	const canEdit = tksUser?.role === "admin" || tksUser?.role === "editor";

	useEffect(() => {
		getReceipt(params.id).then((r) => {
			if (!r) {
				router.replace(PAGE_PATH.receipts);
				return;
			}
			setReceipt(r);
		});
		getTags().then(setTags);
		getTagsForReceipt(params.id).then(setTagIds);
	}, [params.id, router]);

	const receiptTags = tags.filter((t) => tagIds.includes(t.id));

	if (!receipt) return null;

	const taxRateLabel =
		receipt.taxRateCategory === "10"
			? "標準税率 (10%)"
			: receipt.taxRateCategory === "8"
				? "軽減税率 (8%)"
				: receipt.taxRateCategory === "mixed"
					? "混在"
					: null;

	const handleDelete = async () => {
		await deleteReceipt(receipt.id, tksUser?.id ?? null);
		window.location.href = PAGE_PATH.receipts;
	};

	return (
		<div>
			<div className="mb-6 space-y-3">
				<div className="flex items-center gap-3">
					<Button
						render={<Link href={PAGE_PATH.receipts} />}
						variant="ghost"
						size="icon"
						className="shrink-0"
					>
						<ArrowLeft className="h-4 w-4" />
					</Button>
					<h1 className="text-2xl font-bold">レシート詳細</h1>
					{receipt.isAiVerified ? (
						<Badge variant="default">確認済み</Badge>
					) : (
						<Badge variant="secondary">未確認</Badge>
					)}
				</div>
				<div className="flex flex-wrap gap-2 pl-12">
					{isAdmin && !receipt.isAiVerified && (
						<Button
							variant="outline"
							size="sm"
							onClick={async () => {
								const updated = await updateReceipt(
									receipt.id,
									{ isAiVerified: true },
									tksUser?.id ?? null,
								);
								if (updated) setReceipt(updated);
							}}
						>
							<CheckCircle className="mr-1.5 h-4 w-4" />
							確認済みにする
						</Button>
					)}
					{canEdit && (
						<Button
							render={<Link href={PAGE_PATH.receiptEdit(receipt.id)} />}
							variant="outline"
							size="sm"
						>
							<Pencil className="mr-1.5 h-4 w-4" />
							編集
						</Button>
					)}
					{isAdmin && (
						<Dialog>
							<DialogTrigger render={<Button variant="outline" size="sm" />}>
								<Trash2 className="mr-1.5 h-4 w-4" />
								削除
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>レシートを削除しますか？</DialogTitle>
									<DialogDescription>
										この操作は取り消せません。
									</DialogDescription>
								</DialogHeader>
								<DialogFooter>
									<Button variant="destructive" onClick={handleDelete}>
										削除する
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					)}
				</div>
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
						<CardTitle className="text-lg">読取情報</CardTitle>
						{receipt.aiConfidence != null && (
							<Badge variant="secondary">
								AI信頼度: {Math.round(receipt.aiConfidence * 100)}%
							</Badge>
						)}
					</CardHeader>
					<CardContent className="space-y-4">
						<DetailRow
							label="日付"
							value={receipt.date ? formatDate(receipt.date) : null}
						/>
						<DetailRow label="支払先" value={receipt.payee} />
						<Separator />
						<DetailRow
							label="金額（税込）"
							value={
								receipt.amount != null ? formatCurrency(receipt.amount) : null
							}
						/>
						<DetailRow
							label="消費税額"
							value={
								receipt.taxAmount != null
									? formatCurrency(receipt.taxAmount)
									: null
							}
						/>
						<DetailRow label="税率区分" value={taxRateLabel} />
						<Separator />
						<DetailRow label="勘定科目" value={receipt.accountCategory} />
						<DetailRow label="摘要" value={receipt.description} />
						<DetailRow
							label="インボイス番号"
							value={receipt.invoiceRegistrationNo}
						/>
						<Separator />
						<DetailRow label="担当者" value={receipt.personInCharge} />
						<Separator />
						<div className="flex items-start justify-between text-sm">
							<span className="text-muted-foreground">タグ</span>
							<div className="max-w-[70%]">
								<TagBadges tags={receiptTags} />
							</div>
						</div>
						<DetailRow label="登録日" value={formatDate(receipt.createdAt)} />
					</CardContent>
				</Card>

				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle className="text-lg">編集履歴</CardTitle>
					</CardHeader>
					<CardContent>
						<AuditLogList receiptId={receipt.id} />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function DetailRow({
	label,
	value,
}: {
	label: string;
	value: string | null | undefined;
}) {
	return (
		<div className="flex justify-between text-sm">
			<span className="text-muted-foreground">{label}</span>
			<span className="font-medium">{value ?? "-"}</span>
		</div>
	);
}
