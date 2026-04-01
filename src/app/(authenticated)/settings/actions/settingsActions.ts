"use server";

import { revalidatePath } from "next/cache";
import { PAGE_PATH } from "@/constants/pagePath";
import { createClient } from "@/libs/supabase/server";

type ActionState = {
	error: string | null;
	success?: boolean;
};

export async function updateOrganization(
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
		.select("organization_id, role")
		.eq("id", user.id)
		.single();

	if (!profile) {
		return { error: "プロフィールが見つかりません" };
	}

	if (profile.role !== "owner" && profile.role !== "admin") {
		return { error: "組織の設定を変更する権限がありません" };
	}

	const name = formData.get("name") as string;

	if (!name) {
		return { error: "組織名を入力してください" };
	}

	const { error } = await supabase
		.from("organizations")
		.update({
			name,
			updated_at: new Date().toISOString(),
		})
		.eq("id", profile.organization_id);

	if (error) {
		return { error: `組織の更新に失敗しました: ${error.message}` };
	}

	revalidatePath(PAGE_PATH.settings);
	return { error: null, success: true };
}

export async function updateProfile(
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

	const displayName = formData.get("displayName") as string;

	if (!displayName) {
		return { error: "表示名を入力してください" };
	}

	const { error } = await supabase
		.from("profiles")
		.update({
			display_name: displayName,
			updated_at: new Date().toISOString(),
		})
		.eq("id", user.id);

	if (error) {
		return { error: `プロフィールの更新に失敗しました: ${error.message}` };
	}

	revalidatePath(PAGE_PATH.settings);
	return { error: null, success: true };
}
