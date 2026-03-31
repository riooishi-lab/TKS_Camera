import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const notoSansJP = Noto_Sans_JP({
	subsets: ["latin"],
	variable: "--font-noto-sans-jp",
});

export const metadata: Metadata = {
	title: "レシートスキャナー",
	description: "AIでレシートを自動読取・管理するアプリ",
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="ja" className={cn("font-sans", geist.variable)}>
			<body className={`${notoSansJP.variable} font-sans antialiased`}>
				{children}
			</body>
		</html>
	);
}
