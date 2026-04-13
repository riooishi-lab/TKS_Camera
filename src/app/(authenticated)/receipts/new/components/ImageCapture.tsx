"use client";

import { Camera, Plus, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type ImageCaptureProps = {
	onAdd: (file: File) => void;
	onRemove: (index: number) => void;
	onSubmit: () => void;
	files: File[];
	maxFiles: number;
	disabled?: boolean;
};

export function ImageCapture({
	onAdd,
	onRemove,
	onSubmit,
	files,
	maxFiles,
	disabled,
}: ImageCaptureProps) {
	const cameraInputRef = useRef<HTMLInputElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [previews, setPreviews] = useState<string[]>([]);

	const handleFile = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const list = e.target.files;
			if (!list || list.length === 0) return;
			const remaining = maxFiles - files.length;
			const adding = Array.from(list).slice(0, remaining);
			for (const f of adding) {
				onAdd(f);
				setPreviews((prev) => [...prev, URL.createObjectURL(f)]);
			}
			e.target.value = "";
		},
		[files.length, maxFiles, onAdd],
	);

	const handleRemove = (i: number) => {
		const url = previews[i];
		if (url) URL.revokeObjectURL(url);
		setPreviews((prev) => prev.filter((_, idx) => idx !== i));
		onRemove(i);
	};

	const canAdd = !disabled && files.length < maxFiles;
	const hasFiles = files.length > 0;

	return (
		<div className="space-y-4">
			{hasFiles && (
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
					{previews.map((url, i) => (
						<div
							key={url}
							className="relative rounded-lg border bg-muted/30 p-1"
						>
							{/* biome-ignore lint/performance/noImgElement: blob URL preview */}
							<img
								src={url}
								alt={`レシート ${i + 1}`}
								className="h-32 w-full rounded object-contain"
							/>
							{!disabled && (
								<Button
									type="button"
									variant="destructive"
									size="icon"
									className="absolute top-1 right-1 h-6 w-6"
									onClick={() => handleRemove(i)}
								>
									<X className="h-3 w-3" />
								</Button>
							)}
							<p className="mt-1 text-center text-xs text-muted-foreground">
								{i + 1} / {files.length}
							</p>
						</div>
					))}
				</div>
			)}

			{!hasFiles && (
				<div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8">
					<p className="text-sm text-muted-foreground">
						レシートの画像を撮影またはアップロード（最大{maxFiles}枚）
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
				</div>
			)}

			{hasFiles && !disabled && (
				<div className="flex flex-wrap items-center justify-between gap-2">
					<span className="text-sm text-muted-foreground">
						{files.length} / {maxFiles} 枚
					</span>
					<div className="flex gap-2">
						{canAdd && (
							<>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => cameraInputRef.current?.click()}
								>
									<Camera className="mr-1.5 h-4 w-4" />
									撮影して追加
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => fileInputRef.current?.click()}
								>
									<Plus className="mr-1.5 h-4 w-4" />
									ファイル追加
								</Button>
							</>
						)}
						<Button type="button" size="sm" onClick={onSubmit}>
							{files.length}枚をアップロード
						</Button>
					</div>
				</div>
			)}

			<input
				ref={cameraInputRef}
				type="file"
				accept="image/*"
				capture="environment"
				className="hidden"
				onChange={handleFile}
			/>
			<input
				ref={fileInputRef}
				type="file"
				accept="image/*"
				multiple
				className="hidden"
				onChange={handleFile}
			/>
		</div>
	);
}
