"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { deleteReceipt } from "../../actions/receiptActions";

type DeleteReceiptButtonProps = {
	receiptId: string;
};

export function DeleteReceiptButton({ receiptId }: DeleteReceiptButtonProps) {
	const [open, setOpen] = useState(false);
	const [isPending, setIsPending] = useState(false);

	const handleDelete = async () => {
		setIsPending(true);
		await deleteReceipt(receiptId);
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button variant="outline" />}>
				<Trash2 className="mr-2 h-4 w-4" />
				削除
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>レシートを削除しますか？</DialogTitle>
					<DialogDescription>
						この操作は取り消すことができます（論理削除）。
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						キャンセル
					</Button>
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={isPending}
					>
						{isPending ? "削除中..." : "削除する"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
