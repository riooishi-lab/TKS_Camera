# Phase 5: 経費精算機能拡張 タスク分解

- バージョン: 0.1（ドラフト）
- 作成日: 2026-05-25
- 関連: [requirements.md](./requirements.md) / [design.md](./design.md)

---

## 凡例

- `[ ]` 未着手 / `[~]` 進行中 / `[x]` 完了
- **依存**: 先に完了している必要があるタスクID
- **検証**: 完了判定の方法（テスト・手動確認の内容）
- **要件**: 対応する REQ-* / NFR-* / US-* ID

ステップ間で承認を取りやすいよう、`Step 1〜6` の節で区切る。各Stepは原則として独立してリリース可能。

---

## Step 0: 準備（共通基盤）

### T0-1 Resend アカウント開設とAPIキー発行
- **依存**: なし
- **検証**: `.env.example` に `RESEND_API_KEY` の枠が追加され、`.env.local` で送信テストが通る
- **要件**: REQ-N-02, CON-05
- **備考**: 顧客との最終確定が必要。確定までは feature flag で隔離

### T0-2 メール送信ラッパ `src/libs/mail/` の新設
- **依存**: T0-1
- **検証**:
  - `sendMail({to, subject, body})` 関数が単体テストで成功・失敗をモックできる
  - 失敗時に Promise はreject せず `{ok: false, error}` を返す（呼び出し側がアプリ内通知をプライマリに扱えるよう）
- **要件**: REQ-N-03, NFR-R-01

### T0-3 通知ヘルパ `notify()` の中央化
- **依存**: T0-2
- **検証**:
  - `notify({type, recipientId, receiptId?, requestId?})` が `tks_notifications` 挿入と必要に応じたメール送信を1関数で行う
  - イベントタイプの enum/定数を `src/constants/notification-types.ts` に集約
  - 自己発火抑止（REQ-N-04）のテストが通る
- **要件**: REQ-N-01〜04

### T0-4 画像最適化ユーティリティ
- **依存**: なし
- **検証**:
  - sharp 等を使い 長辺2000px / JPEG quality 80 に変換できる
  - SHA-256 ハッシュと EXIF datetime を抽出する単体テストが通る
- **要件**: REQ-IMG-01〜04, NFR-C-01

---

## Step 1: ロール再編と承認フロー簡素化

### T1-1 マイグレーション: ロール rename
- **ファイル**: `supabase/migrations/2026MMDD_phase5_role_rename.sql`
- **内容**: `tks_users.role` CHECK を `('store_staff','store_manager','hq_accountant','president')` へ差し替え、`UPDATE tks_users SET role='store_staff' WHERE role='staff'`
- **依存**: なし
- **検証**: ローカル supabase でマイグ適用、`SELECT DISTINCT role` が4種類
- **要件**: REQ-R-01

### T1-2 マイグレーション: receipt status 簡素化
- **ファイル**: `supabase/migrations/2026MMDD_phase5_status_simplify.sql`
- **内容**:
  - `tks_receipts.status` CHECK を `('pending','manager_approved','accountant_approved','paid','rejected')` に差し替え
  - `UPDATE tks_receipts SET status='accountant_approved' WHERE status='approved'`
  - `president_approved_*` 列は今回**残置**（将来削除）
- **依存**: T1-1
- **検証**: 旧 `approved` データが消え、`accountant_approved` に置換される
- **要件**: REQ-A-01

### T1-3 ロール/権限の型定義刷新
- **ファイル**: `src/constants/roles.ts`, `src/types/`
- **内容**: TS の型 `UserRole = 'store_staff'|'store_manager'|'hq_accountant'|'president'`、`canApproveAsManager(role, receipt)` 等のヘルパを集約
- **依存**: T1-1
- **検証**: 既存コードの `'staff'` リテラルがコンパイルエラーで全置換される
- **要件**: REQ-R-01〜04

### T1-4 承認 Server Action の3段階化
- **ファイル**: `src/app/api/receipts/` および関連 Server Action
- **内容**:
  - submit時、起票者が `store_manager` なら `manager_approved` を自動付与（REQ-A-02）
  - 経理承認: `manager_approved → accountant_approved`
  - 支払: `accountant_approved → paid`
  - 差戻し: any → `rejected`
  - 再submit: `rejected → pending` で `submitted_at` 更新
- **依存**: T1-2, T1-3
- **検証**:
  - Vitest で状態遷移マトリクスをテーブル駆動テスト
  - 自動承認時の audit_logs に "auto" 印字
- **要件**: REQ-A-01〜06

### T1-5 既存UIの3段階化（承認画面・一覧）
- **依存**: T1-4
- **検証**: 手動E2E。store_manager / hq_accountant それぞれで承認動作確認
- **要件**: REQ-A-01〜06, US-2.1, US-3.1

### T1-6 E2Eテスト: 3段階承認
- **ファイル**: `e2e/approval-flow-3stage.spec.ts`
- **依存**: T1-5
- **検証**: store_staff起票 → 店長承認 → 経理承認 → 支払 がPlaywrightで通る
- **要件**: REQ-A-01〜06

---

## Step 2: レシート明細(line items)対応

### T2-1 マイグレーション: `tks_receipt_lines` 新設 + 既存バックフィル
- **ファイル**: `supabase/migrations/2026MMDD_phase5_receipt_lines.sql`
- **内容**:
  - `tks_receipt_lines` CREATE（design §5.2参照）
  - 既存 receipts から `(receipt_id, line_no=1, tax_rate, amount_tax_incl, account_category)` を1行ずつバックフィル
  - バックフィル件数を `RAISE NOTICE` で出力
- **依存**: T1-2
- **検証**: 既存 receipts と lines の件数差分0、合計金額の照合
- **要件**: REQ-RC-01

### T2-2 マイグレーション: receipts 追加列
- **ファイル**: `supabase/migrations/2026MMDD_phase5_receipt_columns.sql`
- **内容**: `submitted_at`, `expense_type`, `invoice_status`, `item_name`, `image_metadata` を ADD
  - `UPDATE tks_receipts SET submitted_at = created_at, expense_type = 'petty_cash'`
- **依存**: T2-1
- **検証**: 全行で `submitted_at IS NOT NULL` かつ `expense_type='petty_cash'`
- **要件**: REQ-LATE-01, REQ-PE-01, REQ-INV-01

### T2-3 集計ロジック `lib/receipt-aggregation.ts`
- **内容**: lines 配列から `(amount, tax_amount, tax_rate_category)` を算出するピュア関数
- **依存**: T2-1
- **検証**:
  - 単一税率: category='8' or '10'
  - 混在: 'mixed'
  - lines 0件 → エラー
  - Vitest 単体テストで網羅
- **要件**: REQ-RC-04, REQ-RC-05

### T2-4 Gemini プロンプト改修と schema 拡張
- **ファイル**: `src/libs/gemini/`
- **内容**: lines 配列を返す JSON schema へ変更、評価データセット (`fixtures/`) を用意し既存精度から劣化していないことを確認
- **依存**: なし（並行可）
- **検証**: 評価セット20枚で抽出精度劣化なし（or ベースライン記録）
- **要件**: REQ-RC-02

### T2-5 レシート入力UI再構築
- **ファイル**: `src/app/(authenticated)/receipts/`
- **内容**: lines の add/edit/delete UI、合計の自動計算表示、勘定科目プルダウン（REQ-RC-06）
- **依存**: T2-3, T2-4
- **検証**: 手動: 混在レシート1枚で2行表示・保存・再編集が成立
- **要件**: REQ-RC-03, REQ-RC-06, US-1.2

### T2-6 既存一覧の「品目」列追加
- **内容**: 一覧テーブルに `item_name` 列を出し、1件クリックせずに概要把握できるよう改善
- **依存**: T2-2
- **検証**: 手動
- **要件**: US-3.1, design §6.4 一覧改善

### T2-7 E2Eテスト: 税率混在レシート
- **ファイル**: `e2e/receipt-mixed-tax.spec.ts`
- **依存**: T2-5
- **検証**: 1枚のレシートに 8%/10% 行を作成 → 保存 → 再オープン → 合計一致
- **要件**: REQ-RC-01〜05

---

## Step 3: 小口現金補充申請

### T3-1 マイグレーション: `tks_cash_replenishment_requests`
- **ファイル**: `supabase/migrations/2026MMDD_phase5_replenishment.sql`
- **依存**: T1-1
- **検証**: テーブル作成、外部キー、index 確認
- **要件**: REQ-REP-01

### T3-2 Server Action: 起票/承認/差戻し/支給済
- **ファイル**: `src/app/api/replenishment/`
- **依存**: T3-1, T0-3
- **検証**:
  - 状態遷移マトリクスのテーブル駆動テスト
  - approved → fulfilled で `tks_cash_deposits` 行が自動作成され `fulfilled_deposit_id` 紐付き
- **要件**: REQ-REP-01〜06

### T3-3 補充申請UI（店舗側起票）
- **ファイル**: `src/app/(authenticated)/replenishment/new/`
- **依存**: T3-2
- **検証**: 手動: store_staff/store_manager で起票成功
- **要件**: US-1.3, REQ-REP-01

### T3-4 補充申請UI（本社承認画面）
- **ファイル**: `src/app/(authenticated)/replenishment/`
- **依存**: T3-2
- **検証**: 手動: 承認・差戻し・支給済記録が動作
- **要件**: US-3.4, REQ-REP-04〜06

### T3-5 ダッシュボードに補充申請バッジ
- **依存**: T3-2
- **検証**: 各店舗の未承認補充申請数、翌月希望額が表示される
- **要件**: REQ-RPT-04

### T3-6 通知連携（承認・差戻し）
- **依存**: T3-2, T0-3
- **検証**: 承認/差戻し時にアプリ内通知＋メール送信、自己発火しない
- **要件**: REQ-N-01, REQ-N-02

### T3-7 E2E: 補充申請フロー
- **ファイル**: `e2e/replenishment.spec.ts`
- **依存**: T3-3, T3-4, T3-6
- **検証**: 起票 → 承認 → 支給済 → cash_deposits 反映が通る
- **要件**: REQ-REP-01〜06

---

## Step 4: 店長立替経費（personal）

### T4-1 入力UIの分岐
- **ファイル**: `src/app/(authenticated)/personal-expenses/` または既存レシートUIへの追加
- **内容**:
  - `expense_type` 選択（既定 petty_cash、store_manager のみ personal 可）
  - `personal` 時に `purpose`/`participants` 必須バリデーション
- **依存**: T2-2, T2-5
- **検証**: store_staff には personal タブが見えない、店長は両方使える
- **要件**: REQ-PE-01〜03, US-2.3

### T4-2 一覧フィルタ拡張
- **依存**: T4-1
- **検証**: `expense_type` フィルタで petty_cash / personal / すべて を切替可能
- **要件**: REQ-PE-05

### T4-3 通知連携（立替経費 経理承認）
- **依存**: T4-1, T0-3
- **検証**: 立替経費の経理承認時にアプリ内通知が起票者へ届く
- **要件**: REQ-N-01

### T4-4 E2E: 立替経費フロー
- **ファイル**: `e2e/personal-expense.spec.ts`
- **依存**: T4-1, T4-2, T4-3
- **検証**: 店長起票（自動承認） → 経理承認 → 支払済 が通る
- **要件**: REQ-PE-01〜05

---

## Step 5: レポート / ダッシュボード強化

### T5-1 月次×店舗ピボットビュー
- **ファイル**: `src/app/(authenticated)/reports/`
- **依存**: T2-2
- **検証**:
  - 行=店舗、列=月、セル=合計金額+承認進捗
  - store ロールは自店舗のみ
  - president/hq_accountant は全店舗
- **要件**: REQ-RPT-01, REQ-RPT-03

### T5-2 ドリルダウン
- **依存**: T5-1
- **検証**: 月セルクリックで該当月のレシート一覧へ遷移
- **要件**: REQ-RPT-02

### T5-3 ダッシュボード集約バッジ
- **内容**: 未承認件数 / 差戻し件数 / 遅延件数 / 翌月補充申請額
- **依存**: T2-2, T3-1
- **検証**: 手動
- **要件**: REQ-RPT-04

### T5-4 expense_type 内訳表示
- **依存**: T4-1, T5-1
- **検証**: 店舗合計に petty_cash / personal の内訳が出る
- **要件**: REQ-RPT-05, US-4.2

### T5-5 性能検証
- **依存**: T5-1
- **検証**: 20店舗 × 100件/月 を仮データで投入し、初期描画2秒以内
- **要件**: NFR-P-01

---

## Step 6: CSV エクスポート（β）

### T6-1 CSV 生成ロジック
- **ファイル**: `src/lib/csv-export.ts`
- **内容**: lines × 受領 receipts を JOIN し1行=1明細で出力。インボイス区分・支払区分を必ず含める
- **依存**: T2-1, T2-2, T4-1
- **検証**:
  - 単体テストで列順・エンコーディング(UTF-8 BOM)を固定
  - 混在税率レシートが複数行に展開される
- **要件**: REQ-CSV-01〜04

### T6-2 エクスポートUI
- **ファイル**: `src/app/(authenticated)/reports/export/` 等
- **内容**: 月・店舗フィルタ → CSV ダウンロード。feature flag で隠す
- **依存**: T6-1
- **検証**: 手動: ファイル名規約に従う `keihi_202605_渋谷店.csv`
- **要件**: REQ-CSV-05, REQ-CSV-06

### T6-3 性能検証
- **依存**: T6-1
- **検証**: 1000件/月で10秒以内
- **要件**: NFR-P-02

### T6-4 勘定奉行フォーマット最終確認 → 列マッピング調整
- **依存**: 顧客から実サンプル受領後
- **検証**: 実サンプルとの diff レビュー、合意取得
- **要件**: REQ-CSV-06

---

## Step 7: 画像最適化 / 電帳法予約列

### T7-1 アップロード時の画像最適化反映
- **依存**: T0-4
- **内容**: 既存アップロードフローに最適化処理を挟む
- **検証**:
  - アップロード前後でサイズ縮小確認
  - `image_metadata.hash` / `exif_datetime` がDBに保存される
- **要件**: REQ-IMG-01〜03, NFR-C-01

### T7-2 timestamp_token 予約列の保持
- **内容**: 書き込まずカラムだけ確保しておく（コードは触らない）
- **検証**: スキーマに列が存在
- **要件**: REQ-IMG-04

---

## Step 8: ドキュメンテーション・運用引継ぎ

### T8-1 README / 運用手順書の更新
- **内容**: ロール変更、承認フロー、補充申請、CSV出力、メール送信障害時の運用を追記
- **依存**: 全Step後半完了

### T8-2 既存 `repair-rls.sql` の新テーブル追加
- **内容**: 新テーブル(`tks_receipt_lines`, `tks_cash_replenishment_requests`)も `DISABLE ROW LEVEL SECURITY` 対象に追加
- **依存**: T2-1, T3-1
- **検証**: 本番手動マイグ前にレビュー
- **要件**: NFR-S-01, CON-01

### T8-3 本番手動マイグレーション順序のチェックリスト化
- **内容**: design §9 をそのまま実行手順書に転記、ロールバック手順も併記
- **依存**: 全マイグレーション確定後

---

## 実装ロードマップ（提案）

| 週 | 着手Step | 主な成果物 |
|---|---|---|
| W1 | Step 0, 1 | 共通基盤、3段階承認 |
| W2 | Step 2 | line items、税率混在UI |
| W3 | Step 3 | 補充申請 完成 |
| W4 | Step 4, 5 | 立替経費、レポート |
| W5 | Step 6, 7 | CSV(β)、画像最適化 |
| W6 | Step 8 + バッファ | ドキュメント、検収 |

各Stepの最後に **顧客レビュー** を挟む（特に Step 3 / 6 はフォーマット確定が必要）。

---

## 未着手の対外確認事項

1. 勘定奉行 CSV フォーマット（Step 6 着手前）
2. Resend 採用可否（Step 0 着手前）
3. 立替経費の勘定科目運用ルール（Step 4 着手前）
4. 画像最適化のスペック許容（Step 7 着手前）

これらは各 Step のキックオフ時に確認ゲートを設ける。
