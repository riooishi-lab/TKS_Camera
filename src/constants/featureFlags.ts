// Phase 5 用 feature flag。
// REQ-CSV-06: 勘定奉行の正式フォーマットが顧客から受領できるまでは β機能として隔離する。
// 環境変数 NEXT_PUBLIC_ENABLE_ACCOUNTING_CSV=true で有効化。
export const FEATURE_FLAGS = {
	accountingCsv: process.env.NEXT_PUBLIC_ENABLE_ACCOUNTING_CSV === "true",
} as const;
