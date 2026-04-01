"use client";

import { Camera, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type ImageCaptureProps = {
	onCapture: (file: File) => void;
	disabled?: boolean;
};

export function ImageCapture({ onCapture, disabled }: ImageCaptureProps) {
	const [mode, setMode] = useState<"select" | "camera" | "preview">("select");
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [stream, setStream] = useState<MediaStream | null>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const startCamera = useCallback(async () => {
		try {
			const mediaStream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: "environment",
					width: { ideal: 1920 },
					height: { ideal: 1080 },
				},
			});
			setStream(mediaStream);
			setMode("camera");
			requestAnimationFrame(() => {
				if (videoRef.current) {
					videoRef.current.srcObject = mediaStream;
				}
			});
		} catch {
			alert(
				"カメラにアクセスできませんでした。ファイルからアップロードしてください。",
			);
		}
	}, []);

	const stopCamera = useCallback(() => {
		if (stream) {
			for (const track of stream.getTracks()) {
				track.stop();
			}
			setStream(null);
		}
	}, [stream]);

	const capturePhoto = useCallback(() => {
		const video = videoRef.current;
		const canvas = canvasRef.current;
		if (!video || !canvas) return;

		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		ctx.drawImage(video, 0, 0);
		stopCamera();

		canvas.toBlob(
			(blob) => {
				if (!blob) return;
				const file = new File([blob], `receipt-${Date.now()}.jpg`, {
					type: "image/jpeg",
				});
				const url = URL.createObjectURL(blob);
				setPreviewUrl(url);
				setMode("preview");
				onCapture(file);
			},
			"image/jpeg",
			0.9,
		);
	}, [stopCamera, onCapture]);

	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;

			const url = URL.createObjectURL(file);
			setPreviewUrl(url);
			setMode("preview");
			onCapture(file);
		},
		[onCapture],
	);

	const reset = useCallback(() => {
		stopCamera();
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
		}
		setPreviewUrl(null);
		setMode("select");
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	}, [stopCamera, previewUrl]);

	if (mode === "preview" && previewUrl) {
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

	if (mode === "camera") {
		return (
			<div className="relative">
				{/* biome-ignore lint/a11y/useMediaCaption: live camera feed */}
				<video
					ref={videoRef}
					autoPlay
					playsInline
					className="w-full rounded-lg border bg-black"
					style={{ maxHeight: "400px" }}
				/>
				<canvas ref={canvasRef} className="hidden" />
				<div className="mt-3 flex justify-center gap-3">
					<Button type="button" variant="outline" onClick={reset}>
						<X className="mr-2 h-4 w-4" />
						キャンセル
					</Button>
					<Button type="button" onClick={capturePhoto}>
						<Camera className="mr-2 h-4 w-4" />
						撮影
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-8">
			<p className="text-sm text-muted-foreground">
				レシートの画像を撮影またはアップロードしてください
			</p>
			<div className="flex gap-3">
				<Button type="button" variant="outline" onClick={startCamera}>
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
			<input
				ref={fileInputRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={handleFileSelect}
			/>
		</div>
	);
}
