"use server";

import { revalidatePath } from "next/cache";
import { PAGE_PATH } from "@/constants/pagePath";
import { createClient } from "@/libs/supabase/server";

type ActionState = {
	error: string | null;
};

export async function createProject(
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

	const name = formData.get("name") as string;
	const description = formData.get("description") as string;

	if (!name) {
		return { error: "プロジェクト名を入力してください" };
	}

	const { error } = await supabase.from("projects").insert({
		organization_id: profile.organization_id,
		name,
		description: description || null,
	});

	if (error) {
		return { error: `プロジェクトの作成に失敗しました: ${error.message}` };
	}

	revalidatePath(PAGE_PATH.projects);
	return { error: null };
}

export async function updateProject(
	projectId: string,
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

	const name = formData.get("name") as string;
	const description = formData.get("description") as string;
	const isActive = formData.get("isActive") === "true";

	if (!name) {
		return { error: "プロジェクト名を入力してください" };
	}

	const { error } = await supabase
		.from("projects")
		.update({
			name,
			description: description || null,
			is_active: isActive,
			updated_at: new Date().toISOString(),
		})
		.eq("id", projectId);

	if (error) {
		return { error: `プロジェクトの更新に失敗しました: ${error.message}` };
	}

	revalidatePath(PAGE_PATH.projects);
	return { error: null };
}

export async function deleteProject(projectId: string): Promise<ActionState> {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { error: "認証が必要です" };
	}

	const { error } = await supabase
		.from("projects")
		.update({ deleted_at: new Date().toISOString() })
		.eq("id", projectId);

	if (error) {
		return { error: `プロジェクトの削除に失敗しました: ${error.message}` };
	}

	revalidatePath(PAGE_PATH.projects);
	return { error: null };
}
