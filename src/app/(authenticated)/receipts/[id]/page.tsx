"use client";

import {
	ArrowLeft,
	Banknote,
	Check,
	Pencil,
	RotateCcw,
	Trash2,
	Undo2,
	X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PAGE_PATH } from "@/constants/pagePath";
import { useAuth } from "@/contexts/AuthContext";
import { buildApprovalPatch, notifyReceiptEvent } from "@/libs/notifications";
import {
	deleteReceipt,
	getReceipt,
	getReceiptLines,
	getStores,
	getTags,
	getTagsForReceipt,
	getUsers,
	isReceiptEditable,
	type Receipt,
	type ReceiptLine,
	type ReceiptStatus,
	type Store,
	type Tag,
	type TksUser,
	updateReceipt,
} from "@/libs/storage";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { AuditLogList } from "../components/AuditLogList";
import { TagBadges } from "../components/TagPicker";

const STATUS_LABELS: Record<ReceiptStatus, string> = {
	pending: "申請中",
	manager_approved: "店長承認済",
	accountant_approved: "経理承認済",
	rejected: "差戻し",
	paid: "支払済",
};

const STATUS_VARIANTS: Record<
	ReceiptStatus,
	"default" | "secondary" | "destructive" | "outline"
> = {
	pending: "secondary",
	manager_approved: "secondary",
	accountant_approved: "default",
	rejected: "destructive",
	paid: "outline",
};

// 楽観ロック不一致（取得後に他者が状態変更）時のメッセージ
const STALE_MESSAGE =
	"レシートの状態が変更されています。ページを再読み込みしてください。";

export default function ReceiptDetailPage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const { tksUser } = useAuth();
	const [receipt, setReceipt] = useState<Receipt | null>(null);
	const [lines, setLines] = useState<ReceiptLine[]>([]);
	const [stores, setStores] = useState<Store[]>([]);
	const [users, setUsers] = useState<TksUser[]>([]);
	const [tags, setTags] = useState<Tag[]>([]);
	const [tagIds, setTagIds] = useState<string[]>([]);
	const [rejectOpen, setRejectOpen] = useState(false);
	const [rejectionReason, setRejectionReason] = useState("");
	const [revertOpen, setRevertOpen] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);

	const role = tksUser?.role;
	const isHqAccountant = role === "hq_accountant";
	// 承認後（manager_approved 以降）は改ざん防止のため編集不可
	const canEdit =
		!!tksUser && receipt != null && isReceiptEditable(receipt.status);
	// 差戻し（rejected）されたレシートを申請者本人が再申請できる
	const canResubmit =
		receipt?.status === "rejected" &&
		receipt.createdBy != null &&
		receipt.createdBy === tksUser?.id;

	// 各ロールが現在のステータスで実行できるアクション
	// Phase 5: 社長承認ステージを廃止し、3段階(店長→経理→支払)に簡素化
	const canManagerApprove =
		role === "store_manager" && receipt?.status === "pending";
	const canAccountantApprove =
		role === "hq_accountant" && receipt?.status === "manager_approved";
	const canApprove = canManagerApprove || canAccountantApprove;
	// 差戻しは各承認者が自分のステージでのみ可能
	const canReject = canApprove;
	// 支払いは経理が accountant_approved 状態で実行
	const canMarkPaid =
		role === "hq_accountant" && receipt?.status === "accountant_approved";

	// 承認・支払の取り消し（巻き戻し）: 各ステージを実行したロールが1段階前に戻せる
	const canRevertManager =
		role === "store_manager" && receipt?.status === "manager_approved";
	const canRevertAccountant =
		role === "hq_accountant" && receipt?.status === "accountant_approved";
	const canRevertPayment =
		role === "hq_accountant" && receipt?.status === "paid";
	const canRevert = canRevertManager || canRevertAccountant || canRevertPayment;
	const revertLabel = canRevertPayment ? "支払を取り消す" : "承認を取り消す";

	useEffect(() => {
		const myUserId = tksUser?.id ?? null;
		const myRole = tksUser?.role;
		const myStoreId = tksUser?.storeId ?? null;
		getReceipt(params.id).then((r) => {
			if (!r) {
				router.replace(PAGE_PATH.receipts);
				return;
			}
			if (myRole === "store_staff" && r.createdBy !== myUserId) {
				router.replace(PAGE_PATH.receipts);
				return;
			}
			if (myRole === "store_manager" && r.storeId !== myStoreId) {
				router.replace(PAGE_PATH.receipts);
				return;
			}
			setReceipt(r);
		});
		getStores().then(setStores);
		getUsers().then(setUsers);
		getTags().then(setTags);
		getTagsForReceipt(params.id).then(setTagIds);
		getReceiptLines(params.id).then(setLines);
	}, [params.id, router, tksUser?.id, tksUser?.role, tksUser?.storeId]);

	const receiptTags = tags.filter((t) => tagIds.includes(t.id));

	if (!receipt) return null;

	const taxRateLabel =
		receipt.taxRateCategory === "10"
			? "標準税率 (10%)"
			: receipt.taxRateCategory === "8"
				? "軽減税率 (8%)"
				: receipt.taxRateCategory === "mixed"
					? "混在"
					: null;

	const storeName = receipt.storeId
		? (stores.find((s) => s.id === receipt.storeId)?.name ?? null)
		: null;

	const userNameById = (id: string | null): string | null => {
		if (!id) return null;
		const u = users.find((x) => x.id === id);
		return u?.name ?? u?.email ?? null;
	};

	const applicantName = userNameById(receipt.createdBy);
	const managerApproverName = userNameById(receipt.managerApprovedBy);
	const accountantApproverName = userNameById(receipt.accountantApprovedBy);
	const paidByName = userNameById(receipt.paidBy);

	const handleDelete = async () => {
		await deleteReceipt(receipt.id, tksUser?.id ?? null);
		window.location.href = PAGE_PATH.receipts;
	};

	const handleApprove = async () => {
		setActionError(null);
		// canApprove で「ロール×現在ステータス」が承認可能であることを担保済み
		if (!canApprove) return;
		const actor = tksUser?.id ?? null;
		const transition = buildApprovalPatch(
			role,
			actor,
			new Date().toISOString(),
		);
		if (!transition) return;
		try {
			const updated = await updateReceipt(
				receipt.id,
				transition.patch,
				actor,
				receipt.status,
			);
			if (updated) {
				setReceipt(updated);
				void notifyReceiptEvent({
					receipt: updated,
					event: transition.event,
					actorId: actor,
				});
			} else {
				setActionError(STALE_MESSAGE);
			}
		} catch (err) {
			setActionError(err instanceof Error ? err.message : "承認に失敗しました");
		}
	};

	const handleReject = async () => {
		if (!rejectionReason.trim()) {
			setActionError("差戻し理由を入力してください");
			return;
		}
		setActionError(null);
		const actor = tksUser?.id ?? null;
		try {
			const updated = await updateReceipt(
				receipt.id,
				{
					status: "rejected",
					rejectionReason: rejectionReason.trim(),
				},
				actor,
				receipt.status,
			);
			if (updated) {
				setReceipt(updated);
				void notifyReceiptEvent({
					receipt: updated,
					event: "rejected",
					actorId: actor,
				});
				setRejectOpen(false);
				setRejectionReason("");
			} else {
				setActionError(STALE_MESSAGE);
			}
		} catch (err) {
			setActionError(
				err instanceof Error ? err.message : "差戻しに失敗しました",
			);
		}
	};

	const handleMarkPaid = async () => {
		setActionError(null);
		const now = new Date().toISOString();
		const actor = tksUser?.id ?? null;
		try {
			const updated = await updateReceipt(
				receipt.id,
				{ status: "paid", paidBy: actor, paidAt: now },
				actor,
				receipt.status,
			);
			if (updated) {
				setReceipt(updated);
				void notifyReceiptEvent({
					receipt: updated,
					event: "paid",
					actorId: actor,
				});
			} else {
				setActionError(STALE_MESSAGE);
			}
		} catch (err) {
			setActionError(
				err instanceof Error ? err.message : "支払い記録に失敗しました",
			);
		}
	};

	const handleRevert = async () => {
		setActionError(null);
		const actor = tksUser?.id ?? null;
		try {
			// 現在のステータスに応じて1段階前に巻き戻し、当該ステージの承認情報をクリアする
			// Phase 5: 社長ステージを廃止し、支払の巻き戻しは accountant_approved へ戻す
			let patch: Partial<Receipt>;
			if (canRevertManager) {
				patch = {
					status: "pending",
					managerApprovedBy: null,
					managerApprovedAt: null,
				};
			} else if (canRevertAccountant) {
				patch = {
					status: "manager_approved",
					accountantApprovedBy: null,
					accountantApprovedAt: null,
				};
			} else if (canRevertPayment) {
				patch = {
					status: "accountant_approved",
					paidBy: null,
					paidAt: null,
				};
			} else {
				return;
			}
			const updated = await updateReceipt(
				receipt.id,
				patch,
				actor,
				receipt.status,
			);
			if (updated) {
				setReceipt(updated);
				setRevertOpen(false);
			} else {
				setActionError(STALE_MESSAGE);
			}
		} catch (err) {
			setActionError(
				err instanceof Error ? err.message : "取り消しに失敗しました",
			);
		}
	};

	const handleResubmit = async () => {
		setActionError(null);
		const actor = tksUser?.id ?? null;
		try {
			// 申請中に戻し、これまでの承認・差戻し情報をクリアして承認フローを最初からやり直す
			const updated = await updateReceipt(
				receipt.id,
				{
					status: "pending",
					rejectionReason: null,
					managerApprovedBy: null,
					managerApprovedAt: null,
					accountantApprovedBy: null,
					accountantApprovedAt: null,
				},
				actor,
				receipt.status,
			);
			if (updated) {
				setReceipt(updated);
				void notifyReceiptEvent({
					receipt: updated,
					event: "resubmitted",
					actorId: actor,
				});
			} else {
				setActionError(STALE_MESSAGE);
			}
		} catch (err) {
			setActionError(
				err instanceof Error ? err.message : "再申請に失敗しました",
			);
		}
	};

	return (
		<div>
			<div className="mb-6 space-y-3">
				<div className="flex items-center gap-3">
					<Button
						render={<Link href={PAGE_PATH.receipts} />}
						nativeButton={false}
						variant="ghost"
						size="icon"
						className="shrink-0"
					>
						<ArrowLeft className="h-4 w-4" />
					</Button>
					<h1 className="text-2xl font-bold">レシート詳細</h1>
					<Badge variant={STATUS_VARIANTS[receipt.status]}>
						{STATUS_LABELS[receipt.status]}
					</Badge>
					{receipt.expenseType === "personal" && (
						<Badge
							variant="outline"
							className="border-amber-400 text-amber-700"
						>
							店長立替
						</Badge>
					)}
					{receipt.date &&
						receipt.submittedAt &&
						receipt.date.slice(0, 7) !== receipt.submittedAt.slice(0, 7) && (
							<Badge
								variant="outline"
								className="border-orange-400 text-orange-700"
							>
								遅延申請
							</Badge>
						)}
				</div>
				<div className="flex flex-wrap gap-2 pl-12">
					{canApprove && (
						<Button
							variant="default"
							size="sm"
							onClick={handleApprove}
							className="bg-green-600 hover:bg-green-700"
						>
							<Check className="mr-1.5 h-4 w-4" />
							承認
						</Button>
					)}
					{canReject && (
						<Button
							variant="destructive"
							size="sm"
							onClick={() => setRejectOpen(true)}
						>
							<X className="mr-1.5 h-4 w-4" />
							差戻し
						</Button>
					)}
					{canMarkPaid && (
						<Button
							variant="default"
							size="sm"
							onClick={handleMarkPaid}
							className="bg-blue-600 hover:bg-blue-700"
						>
							<Banknote className="mr-1.5 h-4 w-4" />
							{receipt.expenseType === "personal"
								? "給与振込で支給済にする"
								: "支払済にする"}
						</Button>
					)}
					{canRevert && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setRevertOpen(true)}
						>
							<Undo2 className="mr-1.5 h-4 w-4" />
							{revertLabel}
						</Button>
					)}
					{canResubmit && (
						<Button
							variant="default"
							size="sm"
							onClick={handleResubmit}
							className="bg-green-600 hover:bg-green-700"
						>
							<RotateCcw className="mr-1.5 h-4 w-4" />
							再申請
						</Button>
					)}
					{canEdit && (
						<Button
							render={<Link href={PAGE_PATH.receiptEdit(receipt.id)} />}
							nativeButton={false}
							variant="outline"
							size="sm"
						>
							<Pencil className="mr-1.5 h-4 w-4" />
							編集
						</Button>
					)}
					{isHqAccountant && (
						<Dialog>
							<DialogTrigger render={<Button variant="outline" size="sm" />}>
								<Trash2 className="mr-1.5 h-4 w-4" />
								削除
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>レシートを削除しますか？</DialogTitle>
									<DialogDescription>
										この操作は取り消せません。
									</DialogDescription>
								</DialogHeader>
								<DialogFooter>
									<Button variant="destructive" onClick={handleDelete}>
										削除する
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					)}
				</div>
				{actionError && (
					<p className="pl-12 text-sm text-destructive">{actionError}</p>
				)}
			</div>

			<div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">レシート画像</CardTitle>
					</CardHeader>
					<CardContent>
						{/* biome-ignore lint/performance/noImgElement: base64 data URL */}
						<img
							src={receipt.imageUrl}
							alt="レシート"
							className="w-full rounded-lg border object-contain"
							style={{ maxHeight: "500px" }}
						/>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-lg">読取情報</CardTitle>
						{receipt.aiConfidence != null && (
							<Badge variant="secondary">
								AI信頼度: {Math.round(receipt.aiConfidence * 100)}%
							</Badge>
						)}
					</CardHeader>
					<CardContent className="space-y-4">
						<DetailRow
							label="日付"
							value={receipt.date ? formatDate(receipt.date) : null}
						/>
						<DetailRow label="支払先" value={receipt.payee} />
						<Separator />
						<DetailRow
							label="金額（税込）"
							value={
								receipt.amount != null ? formatCurrency(receipt.amount) : null
							}
						/>
						<DetailRow
							label="消費税額"
							value={
								receipt.taxAmount != null
									? formatCurrency(receipt.taxAmount)
									: null
							}
						/>
						<DetailRow label="税率区分" value={taxRateLabel} />
						<Separator />
						<DetailRow label="勘定科目" value={receipt.accountCategory} />
						<DetailRow label="摘要" value={receipt.description} />
						<DetailRow
							label="インボイス番号"
							value={receipt.invoiceRegistrationNo}
						/>
						<Separator />
						<DetailRow label="店舗" value={storeName} />
						<DetailRow label="申請者" value={applicantName} />
						<DetailRow
							label="申請区分"
							value={
								receipt.expenseType === "personal"
									? "店長立替（給与同時振込）"
									: "小口現金"
							}
						/>
						<DetailRow label="目的" value={receipt.purpose} />
						<DetailRow label="参加者" value={receipt.participants} />
						<Separator />
						<div className="flex items-start justify-between text-sm">
							<span className="text-muted-foreground">タグ</span>
							<div className="max-w-[70%]">
								<TagBadges tags={receiptTags} />
							</div>
						</div>
						<DetailRow label="登録日" value={formatDate(receipt.createdAt)} />
					</CardContent>
				</Card>

				{lines.length > 0 && (
					<Card className="lg:col-span-2">
						<CardHeader>
							<CardTitle className="text-lg">明細</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="overflow-x-auto rounded-md border">
								<table className="w-full text-sm">
									<thead className="bg-muted/50 text-xs text-muted-foreground">
										<tr>
											<th className="px-3 py-2 text-left font-medium">#</th>
											<th className="px-3 py-2 text-left font-medium">税率</th>
											<th className="px-3 py-2 text-right font-medium">
												税込金額
											</th>
											<th className="px-3 py-2 text-left font-medium">
												勘定科目
											</th>
											<th className="px-3 py-2 text-left font-medium">品目</th>
											<th className="px-3 py-2 text-center font-medium">
												インボ
											</th>
										</tr>
									</thead>
									<tbody>
										{lines.map((l) => (
											<tr key={l.id} className="border-t">
												<td className="px-3 py-2 text-muted-foreground">
													{l.lineNo}
												</td>
												<td className="px-3 py-2">
													{l.taxRate === 0 ? "非課税" : `${l.taxRate}%`}
												</td>
												<td className="px-3 py-2 text-right font-medium tabular-nums">
													{formatCurrency(l.amountTaxIncl)}
												</td>
												<td className="px-3 py-2">{l.accountCategory}</td>
												<td className="px-3 py-2">{l.itemName ?? "-"}</td>
												<td className="px-3 py-2 text-center">
													{l.invoiceEligible ? "○" : "-"}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</CardContent>
					</Card>
				)}

				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle className="text-lg">承認履歴</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<ApprovalStep
							label="店舗管理者承認"
							at={receipt.managerApprovedAt}
							by={managerApproverName}
						/>
						<ApprovalStep
							label="経理承認"
							at={receipt.accountantApprovedAt}
							by={accountantApproverName}
						/>
						<ApprovalStep label="支払い" at={receipt.paidAt} by={paidByName} />
						{receipt.status === "rejected" && (
							<div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
								<div className="font-medium text-destructive">差戻し</div>
								{receipt.rejectionReason && (
									<div className="mt-1 text-muted-foreground">
										理由: {receipt.rejectionReason}
									</div>
								)}
							</div>
						)}
					</CardContent>
				</Card>

				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle className="text-lg">編集履歴</CardTitle>
					</CardHeader>
					<CardContent>
						<AuditLogList receiptId={receipt.id} />
					</CardContent>
				</Card>
			</div>

			{/* 差戻しダイアログ */}
			<Dialog
				open={rejectOpen}
				onOpenChange={(v) => {
					setRejectOpen(v);
					if (!v) {
						setRejectionReason("");
						setActionError(null);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>差戻し理由を入力</DialogTitle>
						<DialogDescription>
							申請者に通知される理由を入力してください。
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<Label htmlFor="rejectionReason">理由</Label>
						<Input
							id="rejectionReason"
							value={rejectionReason}
							onChange={(e) => setRejectionReason(e.target.value)}
							placeholder="例: 領収書の日付が読み取れません"
						/>
						{actionError && (
							<p className="text-sm text-destructive">{actionError}</p>
						)}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setRejectOpen(false)}>
							キャンセル
						</Button>
						<Button variant="destructive" onClick={handleReject}>
							差戻す
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* 承認・支払 取り消し確認ダイアログ */}
			<Dialog
				open={revertOpen}
				onOpenChange={(v) => {
					setRevertOpen(v);
					if (!v) setActionError(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{revertLabel}か？</DialogTitle>
						<DialogDescription>
							ステータスが1段階前に戻ります。この操作は編集履歴に記録されます。
						</DialogDescription>
					</DialogHeader>
					{actionError && (
						<p className="text-sm text-destructive">{actionError}</p>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setRevertOpen(false)}>
							キャンセル
						</Button>
						<Button variant="destructive" onClick={handleRevert}>
							{revertLabel}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function ApprovalStep({
	label,
	at,
	by,
}: {
	label: string;
	at: string | null;
	by: string | null;
}) {
	const done = at != null;
	return (
		<div className="flex items-center justify-between text-sm">
			<div className="flex items-center gap-2">
				<div
					className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
						done
							? "bg-green-600 text-white"
							: "border border-muted-foreground/30 text-muted-foreground"
					}`}
				>
					{done ? <Check className="h-3.5 w-3.5" /> : ""}
				</div>
				<span className={done ? "font-medium" : "text-muted-foreground"}>
					{label}
				</span>
			</div>
			<div className="text-right text-xs text-muted-foreground">
				{done ? (
					<>
						<div>{by ?? "-"}</div>
						<div>{at ? formatDate(at) : ""}</div>
					</>
				) : (
					<span>未</span>
				)}
			</div>
		</div>
	);
}

function DetailRow({
	label,
	value,
}: {
	label: string;
	value: string | null | undefined;
}) {
	return (
		<div className="flex justify-between text-sm">
			<span className="text-muted-foreground">{label}</span>
			<span className="font-medium">{value ?? "-"}</span>
		</div>
	);
}
