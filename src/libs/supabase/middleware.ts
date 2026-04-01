import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { clientEnv } from "@/env/client";

export async function updateSession(request: NextRequest) {
	let supabaseResponse = NextResponse.next({
		request,
	});

	const supabase = createServerClient(
		clientEnv.supabaseUrl,
		clientEnv.supabaseAnonKey,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet) {
					for (const { name, value } of cookiesToSet) {
						request.cookies.set(name, value);
					}
					supabaseResponse = NextResponse.next({
						request,
					});
					for (const { name, value, options } of cookiesToSet) {
						supabaseResponse.cookies.set(name, value, options);
					}
				},
			},
		},
	);

	const {
		data: { user },
	} = await supabase.auth.getUser();

	// 認証が必要なルートへの未認証アクセスをリダイレクト
	const isAuthRoute = request.nextUrl.pathname.startsWith("/auth/");
	const isApiRoute = request.nextUrl.pathname.startsWith("/api/");

	if (!user && !isAuthRoute && !isApiRoute) {
		const url = request.nextUrl.clone();
		url.pathname = "/auth/signin";
		return NextResponse.redirect(url);
	}

	// 認証済みユーザーがauth画面にアクセスした場合リダイレクト
	if (user && isAuthRoute) {
		const url = request.nextUrl.clone();
		url.pathname = "/receipts";
		return NextResponse.redirect(url);
	}

	return supabaseResponse;
}
