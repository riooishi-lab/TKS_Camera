export const ACCOUNT_CATEGORIES = [
	{ value: "交通費", label: "交通費" },
	{ value: "旅費交通費", label: "旅費交通費" },
	{ value: "交際費", label: "交際費" },
	{ value: "会議費", label: "会議費" },
	{ value: "消耗品費", label: "消耗品費" },
	{ value: "通信費", label: "通信費" },
	{ value: "福利厚生費", label: "福利厚生費" },
	{ value: "広告宣伝費", label: "広告宣伝費" },
	{ value: "外注費", label: "外注費" },
	{ value: "雑費", label: "雑費" },
] as const;

export type AccountCategory = (typeof ACCOUNT_CATEGORIES)[number]["value"];
