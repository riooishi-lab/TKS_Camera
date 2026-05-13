import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PAGE_PATH } from "@/constants/pagePath";
import { NewReceiptFlow } from "./components/NewReceiptFlow";

export default function NewReceiptPage() {
	return (
		<div>
			<div className="mb-6 flex items-center gap-4">
				<Button
					render={<Link href={PAGE_PATH.receipts} />}
					nativeButton={false}
					variant="ghost"
					size="icon"
				>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<h1 className="text-2xl font-bold">レシート登録</h1>
			</div>
			<div className="mx-auto max-w-2xl">
				<NewReceiptFlow />
			</div>
		</div>
	);
}
