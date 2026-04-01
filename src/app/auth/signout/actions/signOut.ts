"use server";

import { redirect } from "next/navigation";
import { PAGE_PATH } from "@/constants/pagePath";
import { createClient } from "@/libs/supabase/server";

export async function signOut() {
	const supabase = await createClient();
	await supabase.auth.signOut();
	redirect(PAGE_PATH.signIn);
}
