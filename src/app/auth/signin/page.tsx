import Link from "next/link";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { PAGE_PATH } from "@/constants/pagePath";
import { SignInForm } from "./components/SignInForm";

export default function SignInPage() {
	return (
		<div className="flex min-h-screen items-center justify-center px-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl">ログイン</CardTitle>
					<CardDescription>アカウントにログインしてください</CardDescription>
				</CardHeader>
				<CardContent>
					<SignInForm />
					<p className="mt-4 text-center text-sm text-muted-foreground">
						アカウントをお持ちでないですか？{" "}
						<Link
							href={PAGE_PATH.signUp}
							className="text-primary underline-offset-4 hover:underline"
						>
							新規登録
						</Link>
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
