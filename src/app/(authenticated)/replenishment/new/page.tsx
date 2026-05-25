"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PAGE_PATH } from "@/constants/pagePath";
import { useAuth } from "@/contexts/AuthContext";
import { notifyReplenishmentEvent } from "@/libs/notifications";
import {
	createReplenishmentRequest,
	getStores,
	type Store,
} from "@/libs/storage";

// 次月の月初日（YYYY-MM-01）を既定値として返す
function defaultTargetMonth(): string {
	const d = new Date();
	d.setMonth(d.getMonth() + 1);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	return `${y}-${m}`;
}

export default function NewReplenishmentRequestPage() {
	const router = useRouter();
	const { tksUser } = useAuth();
	const [stores, setStores] = useState<Store[]>([]);
	const [storeId, setStoreId] = useState("");
	const [targetMonth, setTargetMonth] = useState(defaultTargetMonth());
	const [amount, setAmount] = useState("");
	const [reason, setReason] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		getStores().then((s) => {
			setStores(s);
			// 店舗ロールは自店舗固定。本社経理は最初の店舗をデフォに。
			if (tksUser?.storeId) setStoreId(tksUser.storeId);
			else if (s.length > 0) setStoreId(s[0].id);
		});
	}, [tksUser?.storeId]);

	if (tksUser?.role === "president") {
		return (
			<div className="py-12 text-center text-muted-foreground">
				社長は閲覧専用のため申請できません
			</div>
		);
	}

	// 店舗ロールは自店舗以外には申請できない
	const isStoreRole =
		tksUser?.role === "store_staff" || tksUser?.role === "store_manager";

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		const amt = Number.parseInt(amount, 10);
		if (!Number.isFinite(amt) || amt <= 0) {
			setError("金額は正の整数を入力してください");
			return;
		}
		if (!storeId) {
			setError("店舗を選択してください");
			return;
		}
		setSubmitting(true);
		try {
			const created = await createReplenishmentRequest({
				storeId,
				targetMonth,
				requestedAmount: amt,
				reason: reason.trim() || null,
				requestedBy: tksUser?.id ?? null,
			});
			void notifyReplenishmentEvent({
				request: created,
				event: "submitted",
				actorId: tksUser?.id ?? null,
			});
			router.replace(PAGE_PATH.replenishment);
		} catch (err) {
			setError(err instanceof Error ? err.message : "申請に失敗しました");
			setSubmitting(false);
		}
	};

	return (
		<div>
			<div className="mb-6 flex items-center gap-3">
				<Button
					render={<Link href={PAGE_PATH.replenishment} />}
					nativeButton={false}
					variant="ghost"
					size="icon"
				>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<h1 className="text-2xl font-bold">小口現金 補充申請</h1>
			</div>

			<Card className="mx-auto max-w-xl">
				<CardHeader>
					<CardTitle className="text-lg">申請内容</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="storeId">店舗</Label>
							<NativeSelect
								id="storeId"
								value={storeId}
								onChange={(e) => setStoreId(e.target.value)}
								disabled={isStoreRole}
								options={stores.map((s) => ({ value: s.id, label: s.name }))}
								placeholder="選択"
							/>
							{isStoreRole && (
								<p className="text-xs text-muted-foreground">
									自店舗のみ申請できます
								</p>
							)}
						</div>
						<div className="space-y-2">
							<Label htmlFor="targetMonth">対象月</Label>
							<Input
								id="targetMonth"
								type="month"
								value={targetMonth}
								onChange={(e) => setTargetMonth(e.target.value)}
								required
							/>
							<p className="text-xs text-muted-foreground">
								翌月の小口現金として補充して欲しい月
							</p>
						</div>
						<div className="space-y-2">
							<Label htmlFor="amount">希望金額</Label>
							<Input
								id="amount"
								type="number"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
								placeholder="例: 100000"
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="reason">理由（任意）</Label>
							<Input
								id="reason"
								value={reason}
								onChange={(e) => setReason(e.target.value)}
								placeholder="例: 月末イベント用に追加で必要"
							/>
						</div>
						{error && <p className="text-sm text-destructive">{error}</p>}
						<Button type="submit" className="w-full" disabled={submitting}>
							{submitting ? "申請中..." : "申請する"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
