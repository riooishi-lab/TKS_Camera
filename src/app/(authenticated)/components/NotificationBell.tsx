"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { PAGE_PATH } from "@/constants/pagePath";
import { useAuth } from "@/contexts/AuthContext";
import {
	type AppNotification,
	getNotifications,
	markAllNotificationsRead,
	markNotificationRead,
} from "@/libs/storage";
import { formatDate } from "@/utils/formatDate";

// 未読通知のポーリング間隔
const POLL_INTERVAL_MS = 60_000;

export function NotificationBell() {
	const { tksUser } = useAuth();
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [items, setItems] = useState<AppNotification[]>([]);

	const load = useCallback(async () => {
		if (!tksUser) return;
		setItems(await getNotifications(tksUser.id));
	}, [tksUser]);

	useEffect(() => {
		load();
		// 非アクティブタブではポーリングせず、再表示時に最新化する
		const timer = setInterval(() => {
			if (document.visibilityState === "visible") load();
		}, POLL_INTERVAL_MS);
		const onVisible = () => {
			if (document.visibilityState === "visible") load();
		};
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			clearInterval(timer);
			document.removeEventListener("visibilitychange", onVisible);
		};
	}, [load]);

	const unreadCount = items.filter((n) => !n.isRead).length;

	const handleSelect = (n: AppNotification) => {
		if (!n.isRead) {
			void markNotificationRead(n.id);
			setItems((prev) =>
				prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)),
			);
		}
		setOpen(false);
		if (n.receiptId) {
			router.push(PAGE_PATH.receiptDetail(n.receiptId));
		}
	};

	const handleMarkAll = async () => {
		if (!tksUser) return;
		await markAllNotificationsRead(tksUser.id);
		setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
	};

	return (
		<>
			<Button
				variant="ghost"
				size="icon"
				className="relative"
				onClick={() => setOpen(true)}
				aria-label={unreadCount > 0 ? `通知（未読${unreadCount}件）` : "通知"}
			>
				<Bell className="h-4 w-4" />
				{unreadCount > 0 && (
					<span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
						{unreadCount > 9 ? "9+" : unreadCount}
					</span>
				)}
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>通知</DialogTitle>
					</DialogHeader>
					{items.length > 0 ? (
						<>
							<div className="flex justify-end">
								<button
									type="button"
									onClick={handleMarkAll}
									disabled={unreadCount === 0}
									className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
								>
									すべて既読にする
								</button>
							</div>
							<div className="max-h-96 space-y-1.5 overflow-y-auto">
								{items.map((n) => (
									<button
										key={n.id}
										type="button"
										onClick={() => handleSelect(n)}
										className={`w-full rounded-md border p-3 text-left text-sm transition-colors hover:bg-accent ${
											n.isRead ? "opacity-60" : "border-primary/40 bg-primary/5"
										}`}
									>
										<div className="flex items-center justify-between gap-2">
											<span className="font-medium">{n.title}</span>
											{!n.isRead && (
												<span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
											)}
										</div>
										{n.body && (
											<p className="mt-0.5 text-muted-foreground">{n.body}</p>
										)}
										<p className="mt-1 text-xs text-muted-foreground">
											{formatDate(n.createdAt)}
										</p>
									</button>
								))}
							</div>
						</>
					) : (
						<p className="py-8 text-center text-sm text-muted-foreground">
							通知はありません
						</p>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
