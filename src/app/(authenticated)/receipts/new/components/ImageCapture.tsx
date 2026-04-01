"use client";

import { Camera, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type ImageCaptureProps = {
	onCapture: (file: File) => void;
	disabled?: boolean;
};

export function ImageCapture({ onCapture, disabled }: ImageCaptureProps) {
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const cameraInputRef = useRef<HTMLInputElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFile = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;

			const url = URL.createObjectURL(file);
			setPreviewUrl(url);
			onCapture(file);
		},
		[onCapture],
	);

	const reset = useCallback(() => {
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
		}
		setPreviewUrl(null);
		if (cameraInputRef.current) cameraInputRef.current.value = "";
		if (fileInputRef.current) fileInputRef.current.value = "";
	}, [previewUrl]);

	if (previewUrl) {
		return (
			<div className="relative">
				{/* biome-ignore lint/performance/noImgElement: blob URL preview */}
				<img
					src={previewUrl}
					alt="レシートプレビュー"
					className="w-full rounded-lg border object-contain"
					style={{ maxHeight: "400px" }}
				/>
				{!disabled && (
					<Button
						type="button"
						variant="outline"
						size="icon"
						className="absolute top-2 right-2"
						onClick={reset}
					>
						<X className="h-4 w-4" />
					</Button>
				)}
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-8">
			<p className="text-sm text-muted-foreground">
				レシートの画像を撮影またはアップロードしてください
			</p>
			<div className="flex gap-3">
				<Button
					type="button"
					variant="outline"
					onClick={() => cameraInputRef.current?.click()}
				>
					<Camera className="mr-2 h-4 w-4" />
					カメラで撮影
				</Button>
				<Button
					type="button"
					variant="outline"
					onClick={() => fileInputRef.current?.click()}
				>
					<Upload className="mr-2 h-4 w-4" />
					ファイル選択
				</Button>
			</div>
			{/* カメラ起動用（モバイルはネイティブカメラが開く） */}
			<input
				ref={cameraInputRef}
				type="file"
				accept="image/*"
				capture="environment"
				className="hidden"
				onChange={handleFile}
			/>
			{/* ファイル選択用（ギャラリーから選ぶ） */}
			<input
				ref={fileInputRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={handleFile}
			/>
		</div>
	);
}
