"use server";

import { redirect } from "next/navigation";
import { PAGE_PATH } from "@/constants/pagePath";
import { createClient } from "@/libs/supabase/server";

type ActionState = {
	error: string | null;
};

export async function signIn(
	_prevState: ActionState,
	formData: FormData,
): Promise<ActionState> {
	const email = formData.get("email") as string;
	const password = formData.get("password") as string;

	if (!email || !password) {
		return { error: "メールアドレスとパスワードを入力してください" };
	}

	const supabase = await createClient();

	const { error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});

	if (error) {
		return { error: "メールアドレスまたはパスワードが正しくありません" };
	}

	redirect(PAGE_PATH.receipts);
}
