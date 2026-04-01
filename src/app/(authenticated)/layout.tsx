import { NavBar } from "./components/NavBar";
import { SeedData } from "./components/SeedData";

export default function AuthenticatedLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="min-h-screen bg-background">
			<SeedData />
			<NavBar />
			<main className="container mx-auto px-4 py-6">{children}</main>
		</div>
	);
}
