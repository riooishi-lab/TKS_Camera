"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { NavBar } from "./components/NavBar";

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

	return (
		<div className="min-h-screen bg-background">
			<NavBar />
			<main className="container mx-auto px-4 py-6">{children}</main>
		</div>
	);
}
