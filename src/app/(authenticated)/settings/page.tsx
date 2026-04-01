import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<h1 className="text-2xl font-bold">設定</h1>
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">アプリについて</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm text-muted-foreground">
					<p>
						レシートスキャナーは、カメラで撮影したレシートをAIが自動で読み取り・管理するアプリです。
					</p>
					<p>データはブラウザのローカルストレージに保存されます。</p>
				</CardContent>
			</Card>
		</div>
	);
}
