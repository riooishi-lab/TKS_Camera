import { NavBar } from "./components/NavBar";

export default function AuthenticatedLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="min-h-screen bg-background">
			<NavBar />
			<main className="container mx-auto px-4 py-6">{children}</main>
		</div>
	);
}
