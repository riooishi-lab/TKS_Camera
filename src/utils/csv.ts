function escapeCsvCell(value: unknown): string {
	if (value == null) return "";
	const s = String(value);
	if (
		s.includes(",") ||
		s.includes('"') ||
		s.includes("\n") ||
		s.includes("\r")
	) {
		return `"${s.replace(/"/g, '""')}"`;
	}
	return s;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
	return rows.map((r) => r.map(escapeCsvCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csvBody: string): void {
	const BOM = "\uFEFF";
	const blob = new Blob([BOM + csvBody], {
		type: "text/csv;charset=utf-8;",
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
