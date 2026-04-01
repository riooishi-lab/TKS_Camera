import { redirect } from "next/navigation";
import { PAGE_PATH } from "@/constants/pagePath";
import { createClient } from "@/libs/supabase/server";
import { NavBar } from "./components/NavBar";

export default async function AuthenticatedLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect(PAGE_PATH.signIn);
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("display_name, role, organization_id")
		.eq("id", user.id)
		.single();

	let organizationName = "";
	if (profile?.organization_id) {
		const { data: org } = await supabase
			.from("organizations")
			.select("name")
			.eq("id", profile.organization_id)
			.single();
		organizationName = org?.name ?? "";
	}

	return (
		<div className="min-h-screen bg-background">
			<NavBar
				displayName={profile?.display_name ?? ""}
				organizationName={organizationName}
			/>
			<main className="container mx-auto px-4 py-6">{children}</main>
		</div>
	);
}
