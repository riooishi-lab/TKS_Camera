"use server";

import { redirect } from "next/navigation";
import { PAGE_PATH } from "@/constants/pagePath";
import { createClient } from "@/libs/supabase/server";

type ActionState = {
	error: string | null;
};

export async function signUp(
	_prevState: ActionState,
	formData: FormData,
): Promise<ActionState> {
	const email = formData.get("email") as string;
	const password = formData.get("password") as string;
	const displayName = formData.get("displayName") as string;
	const organizationName = formData.get("organizationName") as string;

	if (!email || !password || !displayName || !organizationName) {
		return { error: "すべての項目を入力してください" };
	}

	if (password.length < 6) {
		return { error: "パスワードは6文字以上で入力してください" };
	}

	const supabase = await createClient();

	// 1. ユーザー作成
	const { data: authData, error: authError } = await supabase.auth.signUp({
		email,
		password,
	});

	if (authError) {
		return { error: authError.message };
	}

	if (!authData.user) {
		return { error: "ユーザーの作成に失敗しました" };
	}

	// 2. 組織作成
	const slug = organizationName
		.toLowerCase()
		.replace(/[^a-z0-9\u3000-\u9fff]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");

	const { data: org, error: orgError } = await supabase
		.from("organizations")
		.insert({
			name: organizationName,
			slug: `${slug}-${authData.user.id.slice(0, 8)}`,
		})
		.select("id")
		.single();

	if (orgError) {
		return { error: "組織の作成に失敗しました" };
	}

	// 3. プロフィール作成
	const { error: profileError } = await supabase.from("profiles").insert({
		id: authData.user.id,
		organization_id: org.id,
		display_name: displayName,
		role: "owner",
	});

	if (profileError) {
		return { error: "プロフィールの作成に失敗しました" };
	}

	redirect(PAGE_PATH.receipts);
}
