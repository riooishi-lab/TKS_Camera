"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "./components/AppShell";

export default function AuthenticatedLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const router = useRouter();
	const { firebaseUser, tksUser, loading, needsSetup } = useAuth();

	useEffect(() => {
		if (!loading) {
			if (!firebaseUser) {
				router.replace("/login");
			} else if (needsSetup) {
				router.replace("/setup");
			}
		}
	}, [loading, firebaseUser, needsSetup, router]);

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!firebaseUser || !tksUser) return null;

	return <AppShell>{children}</AppShell>;
}
