# Phase 5: 経費精算機能拡張 要件定義書

- バージョン: 0.1（ドラフト）
- 作成日: 2026-05-25
- 関連設計: [design.md](./design.md)

---

## 0. はじめに

### 0.1 背景
本番運用開始後の打ち合わせで挙がった現場運用上の課題を反映し、本システムを「小口現金経費入力ツール」から「店舗経費管理プラットフォーム」へ拡張する。

### 0.2 ステークホルダー
- **店舗担当者（store_staff）**: 各店舗でレシート入力を行うスタッフ
- **店長（store_manager）**: 店舗の責任者。承認権限と立替経費の起票権限を持つ
- **本社経理（hq_accountant）**: 最終承認・支払・会計ソフト連携の責任者
- **社長（president）**: 全社の経費を俯瞰し意思決定を行う

### 0.3 用語
| 用語 | 定義 |
|---|---|
| 小口現金 | 店舗が現金で立替える経費の原資 |
| 補充申請 | 翌月分の小口現金原資を本社へリクエストする手続き |
| 店長立替 | 店長が個人立替で支払い、給与と一緒に振り込まれる経費 |
| インボイス区分 | 適格請求書発行事業者の登録番号有無の区分（仕入税額控除に影響） |
| 遅延申請 | 伝票日付と申請登録日が異なる月にまたがる申請 |

---

## 1. ユーザーストーリー

### 1.1 店舗担当者（store_staff）

**US-1.1**: 店舗担当者として、レシートを写真撮影してアップロードするだけで、AIに項目を自動入力させたい。修正が必要な箇所だけ手で直したい。

**US-1.2**: 店舗担当者として、1枚のレシートに 8% と 10% の商品が混在していても、自動で2行に分けて記録してほしい。

**US-1.3**: 店舗担当者として、月末に翌月分の小口現金補充をシステムから申請したい。メールでやり取りしたくない。

**US-1.4**: 店舗担当者として、自分が起票した申請が承認/差戻しされたら通知を受け取りたい。

### 1.2 店長（store_manager）

**US-2.1**: 店長として、自店舗のスタッフが入力したレシートを承認/差戻しできるようにしたい。

**US-2.2**: 店長として、自分が直接入力したレシートはわざわざ自分で承認しなくても、店長承認まで自動で進んでほしい。

**US-2.3**: 店長として、自分の立替経費（会食・接待など）を別系統で起票し、給与振込時に精算されるようにしたい。

**US-2.4**: 店長として、自店舗の月次経費レポートを一目で確認したい（承認進捗込みで）。

### 1.3 本社経理（hq_accountant）

**US-3.1**: 本社経理として、店舗から上がってきたレシートの最終承認を行い、AI判定が誤っている場合は差戻しせずに自分で修正できるようにしたい。

**US-3.2**: 本社経理として、月次の承認済みレシートを勘定奉行向けCSVに一括出力したい。

**US-3.3**: 本社経理として、インボイス登録番号の有無が会計処理に影響するため、CSVに区分を必ず含めたい。

**US-3.4**: 本社経理として、店舗からの補充申請を承認し、店長会で手渡しした実績を1ステップで記録したい。

**US-3.5**: 本社経理として、月跨ぎの遅延申請が来た場合に、それと判別できるようにしたい。

### 1.4 社長（president）

**US-4.1**: 社長として、承認フローには加わらず、全店舗の月次経費レポートを横断的に閲覧したい。

**US-4.2**: 社長として、店長立替経費の合計と内訳も含めて把握したい。

---

## 2. 機能要件（EARS形式）

EARS表記: `[WHEN/WHILE/IF ...] THE SYSTEM SHALL ...`

### 2.1 ロールと権限

- **REQ-R-01**: THE SYSTEM SHALL support exactly four user roles: `store_staff`, `store_manager`, `hq_accountant`, `president`.
- **REQ-R-02**: WHEN a user with `store_staff` or `store_manager` role accesses receipts, THE SYSTEM SHALL restrict the listing to receipts belonging to the user's `store_id`.
- **REQ-R-03**: THE SYSTEM SHALL allow `hq_accountant` and `president` roles to view receipts and reports across all stores.
- **REQ-R-04**: THE SYSTEM SHALL prevent `president` users from approving, rejecting, or modifying receipts and requests (read-only across the workflow).

### 2.2 承認フロー

- **REQ-A-01**: THE SYSTEM SHALL implement a 3-stage receipt approval workflow: `pending → manager_approved → accountant_approved → paid`.
- **REQ-A-02**: WHEN a receipt is created by a `store_manager`, THE SYSTEM SHALL automatically set its status to `manager_approved` and record the manager as the auto-approver in the audit log.
- **REQ-A-03**: WHEN a receipt is created by a `store_staff`, THE SYSTEM SHALL set its initial status to `pending` and require the store's manager to approve before it can reach `accountant_approved`.
- **REQ-A-04**: THE SYSTEM SHALL allow `store_manager` (own store) and `hq_accountant` (any store) to transition a receipt to `rejected` from any non-`paid` state.
- **REQ-A-05**: WHEN a receipt in `rejected` is re-submitted by the original creator after edit, THE SYSTEM SHALL reset its status to `pending` and update `submitted_at` to the current timestamp.
- **REQ-A-06**: THE SYSTEM SHALL allow only `hq_accountant` to transition a receipt to `paid`.

### 2.3 レシート入力と税率混在

- **REQ-RC-01**: THE SYSTEM SHALL persist every receipt as a parent record (`tks_receipts`) plus at least one detail line (`tks_receipt_lines`).
- **REQ-RC-02**: WHEN a receipt image is uploaded, THE SYSTEM SHALL invoke the Gemini API to extract structured data including multiple lines when mixed tax rates are detected.
- **REQ-RC-03**: THE SYSTEM SHALL allow users to add, edit, or delete individual lines (税率/勘定科目/税込金額/品目名/インボイス対象) after AI extraction.
- **REQ-RC-04**: THE SYSTEM SHALL recompute and persist the receipt's `amount`, `tax_amount`, and `tax_rate_category` from the sum of its lines whenever lines change.
- **REQ-RC-05**: WHEN all lines share the same `tax_rate`, THE SYSTEM SHALL set `tax_rate_category` to `'8'` or `'10'`; otherwise SHALL set it to `'mixed'`.
- **REQ-RC-06**: THE SYSTEM SHALL provide a fixed master list of `account_category` values selectable per line (消耗品費, 事務用品費, 福利厚生費, 接待交際費, 旅費交通費, 通信費, 清掃用品費, 雑費).

### 2.4 インボイス区分

- **REQ-INV-01**: THE SYSTEM SHALL store an `invoice_status` column on each receipt with values `'registered' | 'unregistered' | 'unknown'`.
- **REQ-INV-02**: WHEN OCR extracts a registration number matching the format `T` + 13 digits, THE SYSTEM SHALL set `invoice_status` to `'registered'` and store the number in `invoice_registration_no`.
- **REQ-INV-03**: WHEN OCR completes without a registration number, THE SYSTEM SHALL set `invoice_status` to `'unregistered'` (user can override to `'unknown'` if image is unclear).
- **REQ-INV-04**: THE SYSTEM SHALL include `invoice_status` as a dedicated column in every exported CSV row.

### 2.5 申請登録日と遅延申請

- **REQ-LATE-01**: THE SYSTEM SHALL store `submitted_at` on each receipt, set to the timestamp of the first transition out of "draft" (i.e., the moment the user submits).
- **REQ-LATE-02**: WHEN the user submits a receipt whose `date.year_month` differs from `submitted_at.year_month`, THE SYSTEM SHALL display a confirmation dialog warning the user this is a late submission.
- **REQ-LATE-03**: THE SYSTEM SHALL expose an `is_late` derived flag in receipt listings and reports based on the comparison of `date` and `submitted_at`.
- **REQ-LATE-04**: THE SYSTEM SHALL NOT impose any upper limit on how far back a late submission can date.

### 2.6 小口現金補充申請

- **REQ-REP-01**: THE SYSTEM SHALL allow `store_staff` and `store_manager` to create a `tks_cash_replenishment_requests` row for their own store.
- **REQ-REP-02**: Each request SHALL include `store_id`, `target_month` (normalized to first day of month), `requested_amount`, and optional `reason`.
- **REQ-REP-03**: THE SYSTEM SHALL allow multiple requests per `(store_id, target_month)` to support additional/supplementary requests.
- **REQ-REP-04**: WHEN `hq_accountant` approves a request, THE SYSTEM SHALL transition status to `'approved'` and notify the requester.
- **REQ-REP-05**: WHEN `hq_accountant` marks a request as fulfilled, THE SYSTEM SHALL create a `tks_cash_deposits` row, link it via `fulfilled_deposit_id`, and transition status to `'fulfilled'`.
- **REQ-REP-06**: WHEN `hq_accountant` rejects a request, THE SYSTEM SHALL require `rejection_reason` and notify the requester.

### 2.7 店長立替経費

- **REQ-PE-01**: THE SYSTEM SHALL distinguish receipts via `expense_type` column with values `'petty_cash' | 'personal'`.
- **REQ-PE-02**: ONLY `store_manager` SHALL be able to create receipts with `expense_type = 'personal'`.
- **REQ-PE-03**: WHEN `expense_type = 'personal'`, THE SYSTEM SHALL require `purpose` and `participants` to be non-empty.
- **REQ-PE-04**: THE SYSTEM SHALL apply the same 3-stage approval flow regardless of `expense_type`, with auto-approval at `manager_approved` for store_manager-created records.
- **REQ-PE-05**: THE SYSTEM SHALL label `personal` receipts in the payment view as "給与振込で支給予定" and tag exports accordingly.

### 2.8 レポート / ダッシュボード

- **REQ-RPT-01**: THE SYSTEM SHALL provide a monthly pivot report (store × month) with cells showing total amount and approval progress `(approved_count / total_count)`.
- **REQ-RPT-02**: WHEN a user clicks a month cell, THE SYSTEM SHALL navigate to a drill-down list of receipts in that store/month.
- **REQ-RPT-03**: THE SYSTEM SHALL filter the report for store-role users to show only their own store's data.
- **REQ-RPT-04**: THE SYSTEM SHALL surface, on the dashboard, per-store badges for: 未承認件数, 差戻し件数, 遅延件数, 翌月補充申請額.
- **REQ-RPT-05**: THE SYSTEM SHALL include `expense_type` breakdown (petty_cash vs personal) in store totals.

### 2.9 CSV エクスポート

- **REQ-CSV-01**: THE SYSTEM SHALL allow `hq_accountant` to export receipts as CSV scoped by month and optionally by store.
- **REQ-CSV-02**: THE SYSTEM SHALL include only receipts in status `accountant_approved` or `paid` in the export.
- **REQ-CSV-03**: THE SYSTEM SHALL produce one CSV row per `tks_receipt_lines` row (line-level granularity).
- **REQ-CSV-04**: CSV columns SHALL include at minimum: 伝票日付, 店舗名, 勘定科目, 税込金額, 税率, インボイス区分, 摘要, 品目, 支払区分, レシートID, ライン番号.
- **REQ-CSV-05**: THE SYSTEM SHALL name the file as `keihi_{YYYYMM}_{店舗 or all}.csv`.
- **REQ-CSV-06**: THE SYSTEM SHALL keep the CSV feature behind a feature flag until the exact 勘定奉行 format is confirmed with the customer.

### 2.10 通知

- **REQ-N-01**: THE SYSTEM SHALL deliver in-app notifications for: receipt 差戻し, 経理承認, 支払済, 補充申請 承認, 補充申請 差戻し, 立替経費 経理承認.
- **REQ-N-02**: THE SYSTEM SHALL additionally deliver email notifications for: receipt 差戻し, 補充申請 承認, 補充申請 差戻し.
- **REQ-N-03**: WHEN email delivery fails, THE SYSTEM SHALL still create the in-app notification and log the email failure for admin review.
- **REQ-N-04**: THE SYSTEM SHALL not send notifications for state changes triggered automatically by the same user who made the change (no self-notification).

### 2.11 画像と電子帳簿保存法（予約）

- **REQ-IMG-01**: WHEN a receipt image is uploaded, THE SYSTEM SHALL re-encode it to JPEG with longest edge 2000px and quality 80 before storage.
- **REQ-IMG-02**: THE SYSTEM SHALL compute a SHA-256 hash of the optimized image and store it in `image_metadata.hash`.
- **REQ-IMG-03**: THE SYSTEM SHALL extract EXIF capture datetime if present and store it in `image_metadata.exif_datetime`.
- **REQ-IMG-04**: THE SYSTEM SHALL reserve `image_metadata.timestamp_token` for future timestamp-authority integration but SHALL NOT populate it in this phase.

---

## 3. 非機能要件

### 3.1 性能
- **NFR-P-01**: 月次レポートは 20店舗 × 100件/月 のデータ規模で2秒以内に描画完了する。
- **NFR-P-02**: CSVエクスポートは 1000件/月の規模で10秒以内に完了する。
- **NFR-P-03**: AI抽出のレスポンスは1枚あたり中央値10秒以内（Gemini側のレイテンシに依存）。

### 3.2 容量
- **NFR-C-01**: 画像最適化後の1枚あたりサイズは中央値300KB以下を目標とする。
- **NFR-C-02**: 20店舗 × 300件/月 × 7年保存で約150GBのストレージを見込んだ料金試算を提示する。

### 3.3 セキュリティ
- **NFR-S-01**: RLSは引き続き無効とし、アクセス制御はアプリ層のServer Action入口で実施する。
- **NFR-S-02**: 全Server Actionは入口で Firebase Auth トークン検証と role チェックを必ず行う。
- **NFR-S-03**: 監査ログは receipts, replenishment_requests, users の全 create/update/delete を記録する。

### 3.4 信頼性
- **NFR-R-01**: メール送信失敗時もユーザー操作は成功扱いとし、失敗は別途リトライ可能とする。
- **NFR-R-02**: マイグレーションは BEGIN/COMMIT で1トランザクション単位で適用する。

### 3.5 可用性
- **NFR-A-01**: Vercel + Supabase の既存稼働水準を維持する（特別なSLAは設定しない）。

---

## 4. 制約・前提

- **CON-01**: 本番DBは手動マイグレーション運用（CLAUDE.mdメモリ参照）。CIによる自動適用はしない。
- **CON-02**: 認証は Firebase Auth、DBは Supabase、anon key + JWT 無しの構成を維持。
- **CON-03**: 画像ストレージは Supabase Storage を継続使用。
- **CON-04**: AI抽出は Google Gemini を継続使用。
- **CON-05**: メール送信基盤は Resend を第一候補とする（最終確定は実装前）。
- **CON-06**: 電子帳簿保存法のJIIMA認証相当の運用は今フェーズ対象外（メタデータ列のみ確保）。

---

## 5. 受け入れ基準（サマリ）

本フェーズの完了条件:

1. 4つのロールと3段階承認フローが稼働している。
2. 1枚のレシートに 8%/10% を混在させた登録 → CSV出力 までが税率行ごとに正しく行える。
3. 補充申請がシステム内で起票 → 承認 → 入金記録の連携 まで完結する。
4. 店長が立替経費を起票し、経理承認 → 支払済 → CSV出力（支払区分=personal）まで通る。
5. 差戻し・補充申請承認時に該当ユーザーへアプリ内通知とメール（該当イベント）が届く。
6. 月次×店舗のピボットレポートが表示され、店舗ロールは自店舗のみ閲覧できる。
7. 既存運用中のレシートデータが、新スキーマで欠損なく閲覧/編集できる（バックフィル成功）。

---

## 6. 未決事項（design.md §11 と同期）

1. 勘定奉行の正式CSVフォーマット
2. メール送信基盤の最終確定
3. 立替経費の勘定科目運用ルール
4. 遅延申請のしきい値
5. インボイス未登録分の80%控除フラグの扱い
6. 画像最適化スペックの最終確定
