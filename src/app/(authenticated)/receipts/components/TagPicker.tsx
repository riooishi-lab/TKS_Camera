"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Tag } from "@/libs/storage";

type TagPickerProps = {
	allTags: Tag[];
	selectedIds: string[];
	onChange: (ids: string[]) => void;
};

export function TagPicker({ allTags, selectedIds, onChange }: TagPickerProps) {
	const selected = new Set(selectedIds);
	const toggle = (id: string) => {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		onChange([...next]);
	};

	if (allTags.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				タグがまだ登録されていません（設定 &gt; タグ管理 から追加できます）
			</p>
		);
	}

	return (
		<div className="flex flex-wrap gap-1.5">
			{allTags.map((tag) => {
				const active = selected.has(tag.id);
				return (
					<button
						key={tag.id}
						type="button"
						onClick={() => toggle(tag.id)}
						className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
							active
								? "border-primary bg-primary/10 text-primary"
								: "border-border text-muted-foreground hover:border-primary/50"
						}`}
						style={
							active && tag.color
								? { borderColor: tag.color, color: tag.color }
								: undefined
						}
					>
						{tag.name}
						{active && <X className="ml-1 inline h-3 w-3" />}
					</button>
				);
			})}
		</div>
	);
}

export function TagBadges({ tags }: { tags: Tag[] }) {
	if (tags.length === 0)
		return <span className="text-muted-foreground">-</span>;
	return (
		<div className="flex flex-wrap gap-1">
			{tags.map((t) => (
				<Badge
					key={t.id}
					variant="outline"
					style={t.color ? { borderColor: t.color, color: t.color } : undefined}
				>
					{t.name}
				</Badge>
			))}
		</div>
	);
}
