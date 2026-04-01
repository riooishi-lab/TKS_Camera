import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PAGE_PATH } from "@/constants/pagePath";
import { createClient } from "@/libs/supabase/server";
import { NewReceiptFlow } from "./components/NewReceiptFlow";

export default async function NewReceiptPage() {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	const { data: profile } = await supabase
		.from("profiles")
		.select("organization_id")
		.eq("id", user?.id)
		.single();

	const { data: projects } = await supabase
		.from("projects")
		.select("id, name")
		.eq("organization_id", profile?.organization_id)
		.eq("is_active", true)
		.order("name");

	return (
		<div>
			<div className="mb-6 flex items-center gap-4">
				<Button
					render={<Link href={PAGE_PATH.receipts} />}
					variant="ghost"
					size="icon"
				>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<h1 className="text-2xl font-bold">レシート登録</h1>
			</div>
			<div className="mx-auto max-w-2xl">
				<NewReceiptFlow projects={projects ?? []} />
			</div>
		</div>
	);
}
