"use client";

import { Check, Plus, Send, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { PAGE_PATH } from "@/constants/pagePath";
import { useAuth } from "@/contexts/AuthContext";
import { notifyReplenishmentEvent } from "@/libs/notifications";
import {
	approveReplenishmentRequest,
	type CashReplenishmentRequest,
	fulfillReplenishmentRequest,
	getReplenishmentRequests,
	getStores,
	getUsers,
	type ReplenishmentStatus,
	rejectReplenishmentRequest,
	type Store,
	type TksUser,
} from "@/libs/storage";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

const STATUS_LABELS: Record<ReplenishmentStatus, string> = {
	pending: "申請中",
	approved: "承認済",
	rejected: "差戻し",
	fulfilled: "支給済",
};

const STATUS_VARIANTS: Record<
	ReplenishmentStatus,
	"default" | "secondary" | "destructive" | "outline"
> = {
	pending: "secondary",
	approved: "default",
	rejected: "destructive",
	fulfilled: "outline",
};

function formatTargetMonth(date: string): string {
	const [y, m] = date.split("-");
	return `${y}年${Number(m)}月`;
}

export default function ReplenishmentPage() {
	const { tksUser } = useAuth();
	const [requests, setRequests] = useState<CashReplenishmentRequest[]>([]);
	const [stores, setStores] = useState<Store[]>([]);
	const [users, setUsers] = useState<TksUser[]>([]);
	const [rejectTarget, setRejectTarget] =
		useState<CashReplenishmentRequest | null>(null);
	const [rejectReason, setRejectReason] = useState("");
	const [fulfillTarget, setFulfillTarget] =
		useState<CashReplenishmentRequest | null>(null);
	const [fulfillDate, setFulfillDate] = useState(
		new Date().toISOString().slice(0, 10),
	);
	const [fulfillDesc, setFulfillDesc] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const role = tksUser?.role;
	const isHq = role === "hq_accountant";
	const isStoreRole = role === "store_staff" || role === "store_manager";
	const canCreate = role !== "president";

	const load = useCallback(async () => {
		const [r, s, u] = await Promise.all([
			getReplenishmentRequests(),
			getStores(),
			getUsers(),
		]);
		// 店舗ロールは自店舗のみ
		if (isStoreRole && tksUser?.storeId) {
			setRequests(r.filter((x) => x.storeId === tksUser.storeId));
		} else {
			setRequests(r);
		}
		setStores(s);
		setUsers(u);
	}, [isStoreRole, tksUser?.storeId]);

	useEffect(() => {
		load();
	}, [load]);

	const storeName = useMemo(() => {
		const m = new Map(stores.map((s) => [s.id, s.name]));
		return (id: string) => m.get(id) ?? "-";
	}, [stores]);

	const userLabel = useMemo(() => {
		const m = new Map(users.map((u) => [u.id, u]));
		return (id: string | null) => {
			if (!id) return "-";
			const u = m.get(id);
			return u?.name ?? u?.email ?? "-";
		};
	}, [users]);

	const handleApprove = async (r: CashReplenishmentRequest) => {
		if (!tksUser?.id) return;
		setError(null);
		setBusy(true);
		try {
			const updated = await approveReplenishmentRequest(r.id, tksUser.id);
			if (updated) {
				void notifyReplenishmentEvent({
					request: updated,
					event: "approved",
					actorId: tksUser.id,
				});
				await load();
			} else {
				setError("承認に失敗しました（状態が変更されている可能性があります）");
			}
		} finally {
			setBusy(false);
		}
	};

	const handleReject = async () => {
		if (!rejectTarget || !tksUser?.id) return;
		if (!rejectReason.trim()) {
			setError("差戻し理由を入力してください");
			return;
		}
		setError(null);
		setBusy(true);
		try {
			const updated = await rejectReplenishmentRequest(
				rejectTarget.id,
				tksUser.id,
				rejectReason.trim(),
			);
			if (updated) {
				void notifyReplenishmentEvent({
					request: updated,
					event: "rejected",
					actorId: tksUser.id,
				});
				setRejectTarget(null);
				setRejectReason("");
				await load();
			} else {
				setError("差戻しに失敗しました");
			}
		} finally {
			setBusy(false);
		}
	};

	const handleFulfill = async () => {
		if (!fulfillTarget || !tksUser?.id) return;
		setError(null);
		setBusy(true);
		try {
			const updated = await fulfillReplenishmentRequest({
				id: fulfillTarget.id,
				actorUserId: tksUser.id,
				depositDate: fulfillDate,
				depositDescription: fulfillDesc.trim() || null,
			});
			if (updated) {
				setFulfillTarget(null);
				setFulfillDesc("");
				await load();
			} else {
				setError("支給済記録に失敗しました");
			}
		} finally {
			setBusy(false);
		}
	};

	// 現在月（翌月分の申請を集計するために使う）
	const nextMonth = useMemo(() => {
		const d = new Date();
		d.setMonth(d.getMonth() + 1);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
	}, []);

	const pendingCount = requests.filter((r) => r.status === "pending").length;
	const approvedCount = requests.filter((r) => r.status === "approved").length;
	const nextMonthRequested = requests
		.filter(
			(r) =>
				r.targetMonth === nextMonth &&
				(r.status === "pending" || r.status === "approved"),
		)
		.reduce((sum, r) => sum + r.requestedAmount, 0);

	return (
		<div>
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">小口現金 補充申請</h1>
				{canCreate && (
					<Button render={<Link href={PAGE_PATH.replenishmentNew} />}>
						<Plus className="mr-1.5 h-4 w-4" />
						新規申請
					</Button>
				)}
			</div>

			{/* サマリー */}
			<div className="mt-4 grid grid-cols-3 gap-3">
				<SummaryCard
					label="申請中"
					value={`${pendingCount}件`}
					highlight={pendingCount > 0}
				/>
				<SummaryCard
					label="承認済（未支給）"
					value={`${approvedCount}件`}
					highlight={approvedCount > 0}
				/>
				<SummaryCard
					label="翌月補充希望額"
					value={formatCurrency(nextMonthRequested)}
				/>
			</div>

			{error && <p className="mt-3 text-sm text-destructive">{error}</p>}

			<Card className="mt-4">
				<CardHeader>
					<CardTitle className="text-lg">申請一覧</CardTitle>
				</CardHeader>
				<CardContent>
					{requests.length === 0 ? (
						<p className="py-8 text-center text-sm text-muted-foreground">
							申請がありません
						</p>
					) : (
						<div className="overflow-x-auto rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>対象月</TableHead>
										<TableHead>店舗</TableHead>
										<TableHead className="text-right">希望金額</TableHead>
										<TableHead>申請者</TableHead>
										<TableHead>申請日</TableHead>
										<TableHead>状態</TableHead>
										<TableHead>理由 / 差戻し理由</TableHead>
										{isHq && <TableHead className="w-44">アクション</TableHead>}
									</TableRow>
								</TableHeader>
								<TableBody>
									{requests.map((r) => (
										<TableRow key={r.id}>
											<TableCell className="font-medium">
												{formatTargetMonth(r.targetMonth)}
											</TableCell>
											<TableCell>{storeName(r.storeId)}</TableCell>
											<TableCell className="text-right tabular-nums">
												{formatCurrency(r.requestedAmount)}
											</TableCell>
											<TableCell className="text-xs">
												{userLabel(r.requestedBy)}
											</TableCell>
											<TableCell className="text-xs text-muted-foreground">
												{formatDate(r.requestedAt)}
											</TableCell>
											<TableCell>
												<Badge variant={STATUS_VARIANTS[r.status]}>
													{STATUS_LABELS[r.status]}
												</Badge>
											</TableCell>
											<TableCell className="text-xs text-muted-foreground">
												{r.status === "rejected"
													? r.rejectionReason
													: (r.reason ?? "-")}
											</TableCell>
											{isHq && (
												<TableCell>
													<div className="flex flex-wrap gap-1">
														{r.status === "pending" && (
															<>
																<Button
																	size="sm"
																	variant="outline"
																	onClick={() => handleApprove(r)}
																	disabled={busy}
																	className="bg-green-50 hover:bg-green-100 dark:bg-green-950/30"
																>
																	<Check className="mr-1 h-3.5 w-3.5" />
																	承認
																</Button>
																<Button
																	size="sm"
																	variant="outline"
																	onClick={() => {
																		setRejectTarget(r);
																		setRejectReason("");
																	}}
																	disabled={busy}
																>
																	<X className="mr-1 h-3.5 w-3.5" />
																	差戻し
																</Button>
															</>
														)}
														{r.status === "approved" && (
															<Button
																size="sm"
																onClick={() => {
																	setFulfillTarget(r);
																	setFulfillDate(
																		new Date().toISOString().slice(0, 10),
																	);
																	setFulfillDesc(
																		`${formatTargetMonth(r.targetMonth)} 補充`,
																	);
																}}
																disabled={busy}
															>
																<Send className="mr-1 h-3.5 w-3.5" />
																支給済にする
															</Button>
														)}
													</div>
												</TableCell>
											)}
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>

			{/* 差戻しダイアログ */}
			<Dialog
				open={rejectTarget !== null}
				onOpenChange={(v) => {
					if (!v) {
						setRejectTarget(null);
						setRejectReason("");
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>差戻し理由を入力</DialogTitle>
						<DialogDescription>
							申請者に通知される理由を入力してください
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<Label htmlFor="reject-reason">理由</Label>
						<Input
							id="reject-reason"
							value={rejectReason}
							onChange={(e) => setRejectReason(e.target.value)}
							placeholder="例: 金額が大きすぎます"
						/>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setRejectTarget(null)}
							disabled={busy}
						>
							キャンセル
						</Button>
						<Button
							variant="destructive"
							onClick={handleReject}
							disabled={busy}
						>
							差戻す
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* 支給済ダイアログ */}
			<Dialog
				open={fulfillTarget !== null}
				onOpenChange={(v) => {
					if (!v) {
						setFulfillTarget(null);
						setFulfillDesc("");
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>現金支給を記録</DialogTitle>
						<DialogDescription>
							{fulfillTarget &&
								`${storeName(fulfillTarget.storeId)} に ${formatCurrency(fulfillTarget.requestedAmount)} を手渡しします。小口現金帳に入金記録が追加されます。`}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<div className="space-y-2">
							<Label htmlFor="fulfill-date">支給日</Label>
							<Input
								id="fulfill-date"
								type="date"
								value={fulfillDate}
								onChange={(e) => setFulfillDate(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="fulfill-desc">摘要（任意）</Label>
							<Input
								id="fulfill-desc"
								value={fulfillDesc}
								onChange={(e) => setFulfillDesc(e.target.value)}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setFulfillTarget(null)}
							disabled={busy}
						>
							キャンセル
						</Button>
						<Button onClick={handleFulfill} disabled={busy}>
							支給を記録
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function SummaryCard({
	label,
	value,
	highlight,
}: {
	label: string;
	value: string;
	highlight?: boolean;
}) {
	return (
		<Card>
			<CardContent className="pt-4 pb-3 text-center">
				<p className="text-xs text-muted-foreground">{label}</p>
				<p className={`text-lg font-bold ${highlight ? "text-primary" : ""}`}>
					{value}
				</p>
			</CardContent>
		</Card>
	);
}
