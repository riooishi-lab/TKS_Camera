import { type SupabaseClient, createClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
	if (!_supabase) {
		const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
		const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
		if (!url || !key) {
			throw new Error(
				"Supabase環境変数が未設定です。NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を確認してください。",
			);
		}
		_supabase = createClient(url, key);
	}
	return _supabase;
}
