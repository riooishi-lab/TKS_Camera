import { ArrowLeft, Pencil } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PAGE_PATH } from "@/constants/pagePath";
import { createClient } from "@/libs/supabase/server";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { DeleteReceiptButton } from "./components/DeleteReceiptButton";

type Props = {
	params: Promise<{ id: string }>;
};

export default async function ReceiptDetailPage({ params }: Props) {
	const { id } = await params;
	const supabase = await createClient();

	const { data: receipt } = await supabase
		.from("receipts")
		.select("*, projects(name)")
		.eq("id", id)
		.is("deleted_at", null)
		.single();

	if (!receipt) {
		notFound();
	}

	const taxRateLabel =
		receipt.tax_rate_category === "10"
			? "標準税率 (10%)"
			: receipt.tax_rate_category === "8"
				? "軽減税率 (8%)"
				: receipt.tax_rate_category === "mixed"
					? "混在"
					: null;

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Button
						render={<Link href={PAGE_PATH.receipts} />}
						variant="ghost"
						size="icon"
					>
						<ArrowLeft className="h-4 w-4" />
					</Button>
					<h1 className="text-2xl font-bold">レシート詳細</h1>
					{receipt.is_ai_verified ? (
						<Badge variant="default">確認済み</Badge>
					) : (
						<Badge variant="secondary">未確認</Badge>
					)}
				</div>
				<div className="flex gap-2">
					<Button
						render={<Link href={PAGE_PATH.receiptEdit(id)} />}
						variant="outline"
					>
						<Pencil className="mr-2 h-4 w-4" />
						編集
					</Button>
					<DeleteReceiptButton receiptId={id} />
				</div>
			</div>

			<div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
				{/* レシート画像 */}
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">レシート画像</CardTitle>
					</CardHeader>
					<CardContent>
						<Image
							src={receipt.image_url}
							alt="レシート"
							width={600}
							height={800}
							className="w-full rounded-lg border object-contain"
							style={{ maxHeight: "500px" }}
						/>
					</CardContent>
				</Card>

				{/* 詳細情報 */}
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">読取情報</CardTitle>
						{receipt.ai_confidence != null && (
							<Badge variant="secondary">
								AI信頼度: {Math.round(receipt.ai_confidence * 100)}%
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
								receipt.tax_amount != null
									? formatCurrency(receipt.tax_amount)
									: null
							}
						/>
						<DetailRow label="税率区分" value={taxRateLabel} />
						<Separator />
						<DetailRow label="勘定科目" value={receipt.account_category} />
						<DetailRow label="摘要" value={receipt.description} />
						<DetailRow
							label="インボイス番号"
							value={receipt.invoice_registration_no}
						/>
						<Separator />
						<DetailRow label="プロジェクト" value={receipt.projects?.name} />
						<DetailRow label="担当者" value={receipt.person_in_charge} />
						<Separator />
						<DetailRow label="登録日" value={formatDate(receipt.created_at)} />
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
