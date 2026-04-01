import { Plus } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { PAGE_PATH } from "@/constants/pagePath";
import { createClient } from "@/libs/supabase/server";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

export default async function ReceiptsPage() {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	const { data: profile } = await supabase
		.from("profiles")
		.select("organization_id")
		.eq("id", user?.id)
		.single();

	const { data: receipts } = await supabase
		.from("receipts")
		.select(
			"id, date, payee, amount, account_category, is_ai_verified, created_at",
		)
		.eq("organization_id", profile?.organization_id)
		.is("deleted_at", null)
		.order("created_at", { ascending: false });

	const hasReceipts = receipts && receipts.length > 0;

	return (
		<div>
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">レシート一覧</h1>
				<Button render={<Link href={PAGE_PATH.receiptNew} />}>
					<Plus className="mr-2 h-4 w-4" />
					レシート登録
				</Button>
			</div>

			{hasReceipts ? (
				<div className="mt-6 rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>日付</TableHead>
								<TableHead>支払先</TableHead>
								<TableHead className="text-right">金額</TableHead>
								<TableHead>勘定科目</TableHead>
								<TableHead>ステータス</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{receipts.map((receipt) => (
								<TableRow key={receipt.id}>
									<TableCell>
										<Link
											href={PAGE_PATH.receiptDetail(receipt.id)}
											className="hover:underline"
										>
											{receipt.date ? formatDate(receipt.date) : "未設定"}
										</Link>
									</TableCell>
									<TableCell>
										<Link
											href={PAGE_PATH.receiptDetail(receipt.id)}
											className="hover:underline"
										>
											{receipt.payee ?? "未設定"}
										</Link>
									</TableCell>
									<TableCell className="text-right">
										{receipt.amount != null
											? formatCurrency(receipt.amount)
											: "-"}
									</TableCell>
									<TableCell>{receipt.account_category ?? "-"}</TableCell>
									<TableCell>
										{receipt.is_ai_verified ? (
											<Badge variant="default">確認済み</Badge>
										) : (
											<Badge variant="secondary">未確認</Badge>
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			) : (
				<div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
					<p className="text-muted-foreground">
						レシートがまだ登録されていません
					</p>
					<Button
						render={<Link href={PAGE_PATH.receiptNew} />}
						variant="outline"
						className="mt-4"
					>
						最初のレシートを登録する
					</Button>
				</div>
			)}
		</div>
	);
}
