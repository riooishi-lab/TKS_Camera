"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PAGE_PATH } from "@/constants/pagePath";
import { createClient } from "@/libs/supabase/server";

type ActionState = {
	error: string | null;
};

export async function createReceipt(
	_prevState: ActionState,
	formData: FormData,
): Promise<ActionState> {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { error: "認証が必要です" };
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("organization_id")
		.eq("id", user.id)
		.single();

	if (!profile) {
		return { error: "プロフィールが見つかりません" };
	}

	const imageUrl = formData.get("imageUrl") as string;
	const imagePath = formData.get("imagePath") as string;

	if (!imageUrl || !imagePath) {
		return { error: "レシート画像が必要です" };
	}

	const date = formData.get("date") as string;
	const payee = formData.get("payee") as string;
	const amountStr = formData.get("amount") as string;
	const taxAmountStr = formData.get("taxAmount") as string;
	const taxRateCategory = formData.get("taxRateCategory") as string;
	const accountCategory = formData.get("accountCategory") as string;
	const description = formData.get("description") as string;
	const invoiceRegistrationNo = formData.get("invoiceRegistrationNo") as string;
	const projectId = formData.get("projectId") as string;
	const personInCharge = formData.get("personInCharge") as string;
	const aiRawResponse = formData.get("aiRawResponse") as string;
	const aiConfidence = formData.get("aiConfidence") as string;

	const { error } = await supabase.from("receipts").insert({
		organization_id: profile.organization_id,
		uploaded_by: user.id,
		date: date || null,
		payee: payee || null,
		amount: amountStr ? Number.parseInt(amountStr, 10) : null,
		tax_amount: taxAmountStr ? Number.parseInt(taxAmountStr, 10) : null,
		tax_rate_category: taxRateCategory || null,
		account_category: accountCategory || null,
		description: description || null,
		invoice_registration_no: invoiceRegistrationNo || null,
		project_id: projectId || null,
		person_in_charge: personInCharge || null,
		image_url: imageUrl,
		image_path: imagePath,
		ai_raw_response: aiRawResponse ? JSON.parse(aiRawResponse) : null,
		ai_confidence: aiConfidence ? Number.parseFloat(aiConfidence) : null,
		is_ai_verified: false,
	});

	if (error) {
		return { error: `レシートの保存に失敗しました: ${error.message}` };
	}

	revalidatePath(PAGE_PATH.receipts);
	redirect(PAGE_PATH.receipts);
}

export async function updateReceipt(
	receiptId: string,
	_prevState: ActionState,
	formData: FormData,
): Promise<ActionState> {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { error: "認証が必要です" };
	}

	const date = formData.get("date") as string;
	const payee = formData.get("payee") as string;
	const amountStr = formData.get("amount") as string;
	const taxAmountStr = formData.get("taxAmount") as string;
	const taxRateCategory = formData.get("taxRateCategory") as string;
	const accountCategory = formData.get("accountCategory") as string;
	const description = formData.get("description") as string;
	const invoiceRegistrationNo = formData.get("invoiceRegistrationNo") as string;
	const projectId = formData.get("projectId") as string;
	const personInCharge = formData.get("personInCharge") as string;

	const { error } = await supabase
		.from("receipts")
		.update({
			date: date || null,
			payee: payee || null,
			amount: amountStr ? Number.parseInt(amountStr, 10) : null,
			tax_amount: taxAmountStr ? Number.parseInt(taxAmountStr, 10) : null,
			tax_rate_category: taxRateCategory || null,
			account_category: accountCategory || null,
			description: description || null,
			invoice_registration_no: invoiceRegistrationNo || null,
			project_id: projectId || null,
			person_in_charge: personInCharge || null,
			is_ai_verified: true,
			updated_at: new Date().toISOString(),
		})
		.eq("id", receiptId);

	if (error) {
		return { error: `レシートの更新に失敗しました: ${error.message}` };
	}

	revalidatePath(PAGE_PATH.receipts);
	redirect(PAGE_PATH.receiptDetail(receiptId));
}

export async function deleteReceipt(receiptId: string): Promise<ActionState> {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { error: "認証が必要です" };
	}

	const { error } = await supabase
		.from("receipts")
		.update({ deleted_at: new Date().toISOString() })
		.eq("id", receiptId);

	if (error) {
		return { error: `レシートの削除に失敗しました: ${error.message}` };
	}

	revalidatePath(PAGE_PATH.receipts);
	redirect(PAGE_PATH.receipts);
}
