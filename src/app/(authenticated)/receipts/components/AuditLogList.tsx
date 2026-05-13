"use client";

import { useEffect, useState } from "react";
import {
	type AuditLog,
	getAuditLogs,
	getUsers,
	type TksUser,
} from "@/libs/storage";

const FIELD_LABELS: Record<string, string> = {
	storeId: "店舗",
	status: "状態",
	date: "日付",
	payee: "支払先",
	amount: "金額",
	taxAmount: "消費税額",
	taxRateCategory: "税率区分",
	accountCategory: "勘定科目",
	description: "摘要",
	invoiceRegistrationNo: "インボイス番号",
	purpose: "目的",
	participants: "参加者",
	isAiVerified: "確認済",
	managerApprovedBy: "店舗管理者承認者",
	managerApprovedAt: "店舗管理者承認日時",
	accountantApprovedBy: "経理承認者",
	accountantApprovedAt: "経理承認日時",
	presidentApprovedBy: "社長承認者",
	presidentApprovedAt: "社長承認日時",
	rejectionReason: "差戻し理由",
	paidBy: "支払者",
	paidAt: "支払日",
	tags: "タグ",
};

function formatValue(v: unknown): string {
	if (v == null || v === "") return "-";
	if (Array.isArray(v)) return v.length === 0 ? "-" : `${v.length}件`;
	if (typeof v === "boolean") return v ? "はい" : "いいえ";
	return String(v);
}

function formatDateTime(iso: string): string {
	const d = new Date(iso);
	return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(
		d.getHours(),
	).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function AuditLogList({ receiptId }: { receiptId: string }) {
	const [logs, setLogs] = useState<AuditLog[]>([]);
	const [userMap, setUserMap] = useState<Map<string, TksUser>>(new Map());
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		Promise.all([getAuditLogs("receipt", receiptId), getUsers()]).then(
			([l, users]) => {
				setLogs(l);
				const m = new Map<string, TksUser>();
				for (const u of users) m.set(u.id, u);
				setUserMap(m);
				setLoaded(true);
			},
		);
	}, [receiptId]);

	if (!loaded) return null;
	if (logs.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">編集履歴はありません</p>
		);
	}

	return (
		<ul className="space-y-3">
			{logs.map((log) => {
				const actor = log.changedBy ? userMap.get(log.changedBy) : null;
				const actorName = actor?.name ?? actor?.email ?? "不明なユーザー";
				const diffEntries = extractDiffEntries(log);
				return (
					<li key={log.id} className="rounded-md border p-3 text-sm">
						<div className="flex items-center justify-between">
							<span className="font-medium">
								{actionLabel(log.action)} / {actorName}
							</span>
							<span className="text-xs text-muted-foreground">
								{formatDateTime(log.changedAt)}
							</span>
						</div>
						{diffEntries.length > 0 && (
							<ul className="mt-2 space-y-1 text-xs">
								{diffEntries.map((e) => (
									<li key={e.key}>
										<span className="text-muted-foreground">
											{FIELD_LABELS[e.key] ?? e.key}:{" "}
										</span>
										<span className="line-through">{formatValue(e.from)}</span>
										<span className="mx-1">→</span>
										<span className="font-medium">{formatValue(e.to)}</span>
									</li>
								))}
							</ul>
						)}
					</li>
				);
			})}
		</ul>
	);
}

function actionLabel(action: AuditLog["action"]): string {
	switch (action) {
		case "create":
			return "作成";
		case "update":
			return "更新";
		case "delete":
			return "削除";
	}
}

type DiffEntry = { key: string; from: unknown; to: unknown };

function extractDiffEntries(log: AuditLog): DiffEntry[] {
	if (log.action !== "update" || !log.diff) return [];
	const diff = (log.diff as Record<string, unknown>).diff as
		| Record<string, { from: unknown; to: unknown }>
		| undefined;
	if (!diff) return [];
	return Object.entries(diff).map(([key, v]) => ({
		key,
		from: v.from,
		to: v.to,
	}));
}
