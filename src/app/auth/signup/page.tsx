import Link from "next/link";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { PAGE_PATH } from "@/constants/pagePath";
import { SignUpForm } from "./components/SignUpForm";

export default function SignUpPage() {
	return (
		<div className="flex min-h-screen items-center justify-center px-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl">アカウント作成</CardTitle>
					<CardDescription>
						レシートスキャナーの利用を開始します
					</CardDescription>
				</CardHeader>
				<CardContent>
					<SignUpForm />
					<p className="mt-4 text-center text-sm text-muted-foreground">
						すでにアカウントをお持ちですか？{" "}
						<Link
							href={PAGE_PATH.signIn}
							className="text-primary underline-offset-4 hover:underline"
						>
							ログイン
						</Link>
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
