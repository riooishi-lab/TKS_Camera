# Phase 5: 経費精算機能拡張 設計書

- バージョン: 0.1（ドラフト）
- 作成日: 2026-05-25
- 対象: receipt-scanner 本番運用後の打ち合わせFB反映

---

## 1. 背景と目的

打ち合わせで挙がった現場運用上のギャップを反映し、本システムを「小口現金経費入力ツール」から「店舗経費管理プラットフォーム」へ拡張する。

主な解決事項:

1. 店舗から本部への **小口現金補充申請** をシステム内で完結（現状メール運用）
2. 1枚のレシートに **8% / 10% や複数勘定科目が混在** するケースの正規化保存
3. **店長立替経費（給与同時振込）** の系統を追加し、店長会以外の経費も一元管理
4. **3段階承認フロー**（店長 → 経理 → 支払）への簡素化、自動承認ルール追加
5. **インボイス区分の運用反映**（登録番号無しは80%控除など）
6. **月跨ぎの遅延申請** を明示化（締めはせず、ステータスで吸収）
7. **レポート/ダッシュボード強化** と **勘定奉行向けCSV出力**
8. **アプリ内 + メール通知** で承認/差戻し/補充申請承認を通知

---

## 2. スコープ

### 2.1 In Scope
- ロール再編・承認フロー3段階化
- `tks_receipt_lines` 新設（税率/勘定科目混在対応）
- `tks_cash_replenishment_requests` 新設（補充申請）
- `tks_personal_expenses`（または receipts への `expense_type` 拡張、§5.4 で決定）
- インボイス区分（`invoice_status` 列）
- 申請登録日（`submitted_at`）と遅延申請ステータス
- 月次/店舗別レポート、店舗ロール別アクセス制御
- 勘定奉行向け汎用CSVエクスポート（フォーマット詳細は実装前に再確認）
- 通知のメール化（Resend想定）

### 2.2 Out of Scope（次フェーズ以降）
- 電子帳簿保存法のJIIMA認証相当のタイムスタンプ運用（**設計上の余地のみ確保**）
- 路面店/百貨店ごとの申請ワークフロー分岐（運用で吸収する判断）
- 勘定奉行APIへの直接連携（CSV手動取込で運用）
- 多通貨・多税率（軽減税率以外）対応

### 2.3 設計判断サマリ（確認済）
| 論点 | 採用 | 備考 |
|---|---|---|
| 店長立替経費モード | 今フェーズで実装 | 同一仕訳・支給フローのみ分離 |
| 税率混在モデル | line items テーブル新設 | レポート/CSVの正規化を優先 |
| 承認フロー | 3段階に簡素化 | 社長は閲覧/横断レポート権限に格下げ |
| 通知チャネル | アプリ内 + メール | Resend想定 |
| 店舗区分 | store_type 不採用 | 全店舗共通で任意の補充申請 |
| 電帳法 | 設計上の考慮のみ | メタデータ列を確保、規則実装は別フェーズ |

---

## 3. ロールと権限

### 3.1 ロール定義

| ロール | 旧 | 新 | 役割 |
|---|---|---|---|
| 店舗担当者 | `staff` | `store_staff` *(rename)* | 自店舗のレシート入力・補充申請起票 |
| 店長 | `store_manager` | `store_manager` | 店舗内承認、自店舗の補充申請起票（自動承認可）、立替経費入力 |
| 本社経理 | `hq_accountant` | `hq_accountant` | 最終承認、支払処理、CSV出力、全店舗閲覧 |
| 社長 | `president` | `president` | 全店舗の閲覧・横断レポート閲覧のみ（承認フローからは外れる） |

旧 `staff` の意味付け（個人の出張精算）は今回廃止し、**全レシートは「店舗が使った経費」または「店長立替経費」のいずれか**とする。

### 3.2 権限マトリクス（抜粋）

| アクション | store_staff | store_manager | hq_accountant | president |
|---|---|---|---|---|
| 自店舗 receipts 入力 | ✓ | ✓ | – | – |
| 自店舗 receipts 承認 | – | ✓ | – | – |
| 自己起票分の自動承認 | – | ✓（manager_approved まで自動） | – | – |
| 本社最終承認/差戻し | – | – | ✓ | – |
| 支払済記録 (`paid`) | – | – | ✓ | – |
| 自店舗 補充申請起票 | ✓ | ✓ | – | – |
| 補充申請 本社承認 | – | – | ✓ | – |
| 店長立替経費 入力 | – | ✓ | – | – |
| 店長立替経費 経理承認 | – | – | ✓ | – |
| 全店舗レポート閲覧 | – | – | ✓ | ✓ |
| 自店舗レポート閲覧 | ✓ | ✓ | – | – |
| CSVエクスポート | – | – | ✓ | – |

---

## 4. 承認フロー

### 4.1 現状（4段階）
`pending → manager_approved → accountant_approved → approved → paid` ／ `rejected`

### 4.2 新フロー（3段階）

```
[起票] ──submit──▶ pending
                    │
                    │ (起票者が store_manager のとき自動付与)
                    ▼
                 manager_approved
                    │
                    │ hq_accountant が承認
                    ▼
                 accountant_approved
                    │
                    │ hq_accountant が「支払済」を押下
                    ▼
                  paid

  ※どの段階からでも hq_accountant / store_manager が `rejected` に遷移可能
  ※rejected 後、起票者が修正して再 submit すると pending に戻る
```

- `approved` ステータスは段階削減により廃止（既存データはマイグレーションで `accountant_approved` に正規化）
- 自動承認ロジックは **DB トリガではなくアプリ層** で適用（監査ログの actor を明確にするため）

### 4.3 店長立替経費の承認

立替経費は店長単独で起票し、`manager_approved` を自動付与 → `hq_accountant` が承認 → `paid`（給与振込連動）。フローは同じだが、`expense_type='personal'` 分岐で支払マスタ表示やCSVの摘要が変わる。

### 4.4 月跨ぎ・遅延申請

- 締めの概念は持たない（日付管理を継続）
- `tks_receipts.submitted_at`（申請登録日）を追加
- `date`（伝票日付）と `submitted_at` が **異なる月** の場合、UI上で「○月分の遅延申請です」と注意喚起バナーを表示
- ステータスとは別軸の派生属性 `is_late = (date.year_month != submitted_at.year_month)` を View で算出（DB列としては持たない）

---

## 5. データモデル

### 5.1 ER概要

```
tks_stores ───┬─< tks_users
              ├─< tks_receipts ─< tks_receipt_lines
              ├─< tks_cash_deposits             （実績/既存）
              ├─< tks_cash_replenishment_requests （新規）
              └─< tks_personal_expenses          （新規 or receipts に統合）

tks_notifications  …  通知（既存）
tks_audit_logs     …  既存
tks_tags / tks_receipt_tags …  既存
```

### 5.2 変更/追加カラム

#### `tks_users`
- `role` CHECKを `('store_staff','store_manager','hq_accountant','president')` に変更
  - 移行: `UPDATE tks_users SET role='store_staff' WHERE role='staff';`

#### `tks_stores`
- 変更なし（`store_type` は採用見送り）

#### `tks_receipts`
| 列 | 変更 | 備考 |
|---|---|---|
| `status` CHECK | `('pending','manager_approved','accountant_approved','paid','rejected')` | `approved` を削除、データは `accountant_approved` に集約 |
| `submitted_at timestamptz` | **新規** | 申請登録日。`created_at` とは別軸（差戻し→再申請で更新） |
| `expense_type text` | **新規** | `'petty_cash'`（既定）/ `'personal'`（店長立替） |
| `invoice_status text` | **新規** | `'registered'`（番号あり）/ `'unregistered'`（番号なし=80%控除対象）/ `'unknown'`（OCR未確定） |
| `item_name text` | **新規** | 品目（旧 `participants` の役割を置換）。AI自動入力＋手動上書き |
| `participants text` | **保持** | 立替経費の会食用途で残置。petty_cash では未使用 |
| `tax_rate_category` | **保持** | `mixed` のとき lines 必須 |
| `amount` / `tax_amount` | **保持** | 集計値（lines の合計） |
| `image_metadata jsonb` | **新規** | 撮影日時/ハッシュ/アップロードUA等、電帳法考慮の予約列 |

#### `tks_receipt_lines`（新規）
```sql
CREATE TABLE tks_receipt_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES tks_receipts(id) ON DELETE CASCADE,
  line_no smallint NOT NULL,
  tax_rate smallint NOT NULL CHECK (tax_rate IN (8, 10, 0)),
  amount_tax_incl integer NOT NULL,
  account_category text NOT NULL,
  item_name text,
  invoice_eligible boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (receipt_id, line_no)
);
CREATE INDEX idx_receipt_lines_receipt ON tks_receipt_lines(receipt_id);
```

- 1レシート＝1行のシンプルケースでも **必ず lines を1行作る**（クエリの一貫性のため）
- `tks_receipts.amount` / `tax_amount` / `tax_rate_category` は lines から **アプリ層で集約再計算** し保存（トリガではなく永続キャッシュ扱い）

#### `tks_cash_replenishment_requests`（新規）
```sql
CREATE TABLE tks_cash_replenishment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES tks_stores(id),
  target_month date NOT NULL,                -- 例: 2026-06-01（6月用）
  requested_amount integer NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','fulfilled')),
  requested_by uuid REFERENCES tks_users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES tks_users(id),
  approved_at timestamptz,
  fulfilled_deposit_id uuid REFERENCES tks_cash_deposits(id),
  rejection_reason text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_replenish_store_month ON tks_cash_replenishment_requests(store_id, target_month);
```

- `target_month` は対象月の月初日で正規化
- `fulfilled` は本社が現金を手渡しした際に `tks_cash_deposits` 行を作成して紐付ける
- 同一 `(store_id, target_month)` で複数申請を許容（追加申請ケース）

#### 店長立替経費の扱い（採用案）

**`tks_receipts` に `expense_type` を持たせて一元化** する（別テーブル `tks_personal_expenses` は採用しない）。

理由:
- 入力・承認・CSV出力のロジックの大半が共通
- レポートで「店舗合計（小口＋立替）」を出すクエリが簡潔
- 立替特有の項目（参加者・目的）は既存列で吸収可能

差別化ポイント:
- `expense_type='personal'` の場合のみ `participants`/`purpose` を必須化（UIバリデーション）
- 支払フローでは「給与振込で支給予定」のラベル表示。実支払は既存の `paid` ステータスで一律管理
- CSV出力時の摘要欄プレフィクスで区別

---

## 6. 機能設計

### 6.1 レシート入力（税率混在対応）

#### 入力UIの構造
```
[画像アップロード]
[AI抽出結果]
 ├─ 共通: 日付 / 店舗 / 支払先 / インボイス番号 / 品目（複数可）
 └─ 明細行（1〜N）
     ├─ 税率（8% / 10% / 非課税）
     ├─ 税込金額
     ├─ 勘定科目（選択式）
     ├─ 品目名（自由入力）
     └─ インボイス対象
[合計金額]（lines から自動計算、ユーザー編集不可）
```

#### AI抽出フロー（Gemini）
1. 画像をアップロード → Gemini に渡して JSON 抽出
2. AI レスポンスから lines 配列を生成
   - 単一税率レシート: lines = 1件
   - 8%/10%混在 (例: コンビニ): lines = 2件以上、税率ごとに集約
3. 信頼度 (`ai_confidence`) と raw を `tks_receipts.ai_raw_response` に保存
4. ユーザーは UI 上で行の追加/削除/編集が可能

#### 勘定科目の選択肢
固定マスタとして以下を用意（運用で増減）:
- 消耗品費 / 事務用品費 / 福利厚生費 / 接待交際費 / 旅費交通費 / 通信費 / 清掃用品費 / 雑費

### 6.2 小口現金補充申請

#### 起票画面（店舗ロール）
- 月次レシート一覧の上部に「翌月用 補充申請」ボタンを設置
- 入力項目: 対象月 / 希望金額 / 理由（任意）
- 申請後ステータス: `pending`

#### 承認画面（本社経理）
- 補充申請一覧 → 承認/差戻し
- 承認時に通知 → 店長会で手渡し → 「現金支給済み」ボタン → `tks_cash_deposits` を自動作成して `fulfilled_deposit_id` を紐付け、ステータス `fulfilled`

#### ダッシュボード上の表示
- 各店舗の「今月残高」「未承認申請」「翌月希望額」を一目で確認

### 6.3 店長立替経費

#### 入力画面（店長のみ）
- 「立替経費を起票」モーダル
- `expense_type='personal'` 固定、`participants`/`purpose` 必須
- 起票と同時に `manager_approved` が自動付与
- 経理が承認 → `paid` 時に「給与同時振込」フラグでCSV出力区別

#### 一覧
- レシート一覧で `expense_type` フィルタを設置
- 既定: petty_cash のみ表示。トグルで personal を含める

### 6.4 レポート / ダッシュボード

#### 月次×店舗ビュー
- ピボット: 行=店舗、列=月、セル=合計金額/承認進捗 `(承認済件数/全件数)`
- ドリルダウン: 月セルクリック → その月の店舗別レシート一覧

#### 店舗ロール向け
- 自店舗のみ表示。月次サマリ＋未承認/差戻し件数のバッジ

#### 本社/社長向け
- 全店舗の月次サマリ、勘定科目別グラフ、インボイス区分別合計

### 6.5 通知

#### イベント定義
| イベント | アプリ内 | メール | 受信者 |
|---|---|---|---|
| receipt 差戻し | ✓ | ✓ | 起票者 |
| receipt 経理承認完了 | ✓ | – | 起票者 |
| receipt 支払済 | ✓ | – | 起票者 |
| 補充申請 承認 | ✓ | ✓ | 申請者・店長 |
| 補充申請 差戻し | ✓ | ✓ | 申請者・店長 |
| 立替経費 経理承認 | ✓ | – | 起票者 |

#### 実装
- 既存 `tks_notifications` テーブルを `type` enum 追加で拡張
- メール送信は Resend を想定（`src/libs/mail/` を新設）
- Server Action / API Route から `notify({type, recipientId, receiptId?, requestId?})` ヘルパを呼ぶ

### 6.6 CSV エクスポート

#### 仕様
- 単位: 月次×店舗（複数店舗をまとめて1ファイル）
- ステータス: `accountant_approved` または `paid` のみ
- 形式: 勘定奉行向け汎用CSV（**正式フォーマットは実装前に再確認**）

#### 想定カラム（暫定）
```
伝票日付, 店舗名, 勘定科目, 税込金額, 税率, インボイス区分, 摘要,
品目, 支払区分(petty_cash|personal), レシートID, ライン番号
```

- `tks_receipt_lines` 1行＝CSV1行で展開（税率混在レシートは複数行になる）
- インボイス区分は会計ソフト側で控除率を切り替えやすいよう常に出力
- ファイル名: `keihi_{YYYYMM}_{店舗 or all}.csv`

### 6.7 申請遅延の取り扱い

- UI: 起票時に `date.year_month != submitted_at.year_month` を検出し、
  「これは○月分の伝票ですが、今月の申請として登録します」と確認ダイアログ表示
- レポート: 「遅延件数」ピンを月次ビューに表示
- 監査ログ: `audit_logs.diff.is_late = true` を残す

### 6.8 画像最適化（電帳法考慮の予約）

- アップロード時に Sharp 等で **長辺2000px / JPEG quality 80** に変換
- 元画像のハッシュ（SHA-256）を `image_metadata.hash` に保存
- 撮影日時（EXIF）を `image_metadata.exif_datetime` に保存
- タイムスタンプ事業者連携は **将来差替え** できるよう、`image_metadata.timestamp_token` を予約列として用意

---

## 7. アーキテクチャ・実装方針

### 7.1 ディレクトリ追加
```
src/
├── app/(authenticated)/
│   ├── replenishment/                 # 補充申請UI（店舗・本社で出し分け）
│   ├── personal-expenses/             # 店長立替経費UI
│   └── reports/                       # 既存。月次ピボット拡張
├── app/api/
│   ├── replenishment/                 # 補充申請API
│   ├── exports/                       # CSVエクスポート
│   └── receipts/lines/                # line items 編集API
├── libs/
│   ├── gemini/                        # 既存。lines 抽出に拡張
│   └── mail/                          # 新規。Resend ラッパ
└── lib/
    └── receipt-aggregation.ts         # lines → receipts 集計ロジック
```

### 7.2 マイグレーション戦略

本番DBは手動マイグレーション運用（CLAUDE.md記載のメモリ準拠）。次の順で適用:

1. `2026MMDD_phase5_role_rename.sql`
   - `tks_users.role` の CHECK 制約差し替え、`staff → store_staff` UPDATE
2. `2026MMDD_phase5_status_simplify.sql`
   - `tks_receipts.status` CHECK 差し替え、`approved → accountant_approved` UPDATE
3. `2026MMDD_phase5_receipt_lines.sql`
   - `tks_receipt_lines` 作成
   - 既存 receipts から lines を1件ずつバックフィル
4. `2026MMDD_phase5_receipt_columns.sql`
   - `submitted_at` / `expense_type` / `invoice_status` / `item_name` / `image_metadata` 追加
   - 既存行は `submitted_at = created_at`、`expense_type = 'petty_cash'` で埋め
5. `2026MMDD_phase5_replenishment.sql`
   - `tks_cash_replenishment_requests` 作成
6. RLSは引き続き無効（既存方針維持）

### 7.3 既存コードへの主要影響

- `src/libs/gemini/`: プロンプトとレスポンス schema を lines 対応に変更
- `src/app/(authenticated)/receipts/`: フォームを lines 編集対応に再構築
- 承認関連 Server Action: 4段階→3段階へ刷新、自動承認分岐追加
- 既存 `tks_cash_deposits` 系UIに「補充申請から作成」フローを追加

---

## 8. 非機能要件

| 項目 | 要件 |
|---|---|
| 性能 | 月次レポートは20店舗×100件/月でも2秒以内 |
| ストレージ | レシート画像は1枚あたり平均300KB（最適化後）想定。20店舗×300件/月×7年 ≒ 150GB |
| 可用性 | 既存と同じ（Vercel + Supabase） |
| セキュリティ | RLS は引き続き無効。アクセス制御はアプリ層で実装。Firebase Auth + role チェックを Server Action 入口で必ず実施 |
| 監査 | 全 receipts/replenishment の作成・更新・状態遷移を `tks_audit_logs` に記録 |
| メール | Resend の delivery 失敗時はアプリ内通知を優先表示し、再送ボタンを提供 |

---

## 9. 移行・ロールアウト計画

1. **マイグレーション SQL を本番に手動適用**（順序厳守）
2. **既存レシートの lines バックフィル** をスクリプトで実施・件数照合
3. **店長ユーザーへの権限再付与**（旧 staff → store_staff の確認）
4. **新UIの段階ロールアウト**:
   - Step1: 補充申請のみ先行リリース（運用負荷が一番大きいため）
   - Step2: 税率混在 lines 対応 + CSV 出力
   - Step3: 店長立替経費モード
   - Step4: レポート/ダッシュボード強化
5. **勘定奉行 CSV 仕様の最終確認** はStep2着手前に必須

---

## 10. リスクと対応

| リスク | 影響 | 対応 |
|---|---|---|
| line items への移行で AI 抽出精度が落ちる | 入力工数増 | プロンプト改修と評価データセットを先に整備 |
| 勘定奉行 CSV 仕様の認識違い | リリース後に手直し | フォーマット確定までCSV機能はβフラグで隔離 |
| 自動承認による不正リスク | 監査指摘 | 自動付与でも `audit_logs` に "auto" actor を明示記録 |
| メール送信失敗 | 通知漏れ | アプリ内通知をプライマリ、メールは補助。失敗ログを管理画面で可視化 |
| 電帳法非対応のまま運用継続 | 税務調査リスク | image_metadata を埋めて将来準拠を容易化、運用上は「クリアファイル保管継続」を社内ルール化 |

---

## 11. 未決事項（次回確認）

1. **勘定奉行の正式CSVフォーマット**（実サンプル待ち）
2. **メール送信基盤**: Resend で確定で良いか、既存基盤があるか
3. **店長立替経費の勘定科目マスタ**: 福利厚生費・接待交際費の運用ルール
4. **遅延申請のしきい値**: 何ヶ月前まで遡って起票を許容するか（暫定: 制限なし）
5. **インボイス未登録分の80%控除フラグ**: CSV出力時に税額自動補正するか、勘定奉行側で吸収するか
6. **画像最適化のスペック**: 長辺2000px / JPEG q=80 で十分か（OCR精度との兼ね合い）

---

## 12. 参考: 既存スキーマからの主要差分（一覧）

```
+ tks_receipt_lines                                (新規)
+ tks_cash_replenishment_requests                  (新規)
~ tks_users.role         CHECK 差し替え + 'staff'→'store_staff'
~ tks_receipts.status    CHECK 差し替え + 'approved' 削除
+ tks_receipts.submitted_at      timestamptz
+ tks_receipts.expense_type      text   ('petty_cash'|'personal')
+ tks_receipts.invoice_status    text   ('registered'|'unregistered'|'unknown')
+ tks_receipts.item_name         text
+ tks_receipts.image_metadata    jsonb
- tks_receipts (4段階用カラムのうち president_* は使用停止、列は残置)
```

`president_approved_*` / `accountant_approved_*` 列のうち、フロー簡素化に伴い `president_approved_*` は使用しなくなる。物理削除は **本番運用が安定してからの別マイグレーション** で実施する。
