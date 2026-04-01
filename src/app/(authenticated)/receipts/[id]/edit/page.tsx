import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PAGE_PATH } from "@/constants/pagePath";
import { createClient } from "@/libs/supabase/server";
import { updateReceipt } from "../../actions/receiptActions";
import { ReceiptForm } from "../../components/ReceiptForm";

type Props = {
	params: Promise<{ id: string }>;
};

export default async function EditReceiptPage({ params }: Props) {
	const { id } = await params;
	const supabase = await createClient();

	const { data: receipt } = await supabase
		.from("receipts")
		.select("*")
		.eq("id", id)
		.is("deleted_at", null)
		.single();

	if (!receipt) {
		notFound();
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("organization_id")
		.eq("id", receipt.uploaded_by)
		.single();

	const { data: projects } = await supabase
		.from("projects")
		.select("id, name")
		.eq("organization_id", profile?.organization_id)
		.eq("is_active", true)
		.order("name");

	const boundAction = updateReceipt.bind(null, id);

	return (
		<div>
			<div className="mb-6 flex items-center gap-4">
				<Button
					render={<Link href={PAGE_PATH.receiptDetail(id)} />}
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

				<Card>
					<CardHeader>
						<CardTitle className="text-lg">情報の編集</CardTitle>
					</CardHeader>
					<CardContent>
						<ReceiptForm
							action={boundAction}
							projects={projects ?? []}
							defaultValues={{
								date: receipt.date,
								payee: receipt.payee,
								amount: receipt.amount,
								taxAmount: receipt.tax_amount,
								taxRateCategory: receipt.tax_rate_category,
								accountCategory: receipt.account_category,
								description: receipt.description,
								invoiceRegistrationNo: receipt.invoice_registration_no,
								projectId: receipt.project_id,
								personInCharge: receipt.person_in_charge,
								confidence: receipt.ai_confidence ?? 0,
							}}
							submitLabel="更新する"
							pendingLabel="更新中..."
						/>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
