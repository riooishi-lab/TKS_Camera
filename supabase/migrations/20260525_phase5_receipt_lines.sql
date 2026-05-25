-- ============================================================
-- Phase 5: tks_receipt_lines 新設 + 既存レシートのバックフィル
-- ------------------------------------------------------------
-- 打ち合わせFB反映:
--   1枚のレシートに 8% / 10% や複数勘定科目が混在するケースを
--   正規化して保存できるよう、明細テーブルを新設する。
--
-- 1レシート = N明細の関係。シンプルなレシート（単一税率・単一勘定）でも
-- 必ず lines を1行作る（クエリの一貫性のため: REQ-RC-01）。
--
-- バックフィル方針:
--   既存 receipts から (receipt_id, line_no=1, tax_rate, amount, category) を1行ずつ生成。
--   ・tax_rate_category が 'mixed' / NULL の場合は 10 をフォールバック
--   ・amount が NULL の場合は 0 で埋める（既存データの欠損許容）
--   ・account_category が NULL の場合は '雑費' で埋める
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS tks_receipt_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES tks_receipts(id) ON DELETE CASCADE,
  line_no smallint NOT NULL,
  tax_rate smallint NOT NULL CHECK (tax_rate IN (0, 8, 10)),
  amount_tax_incl integer NOT NULL,
  account_category text NOT NULL,
  item_name text,
  invoice_eligible boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (receipt_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_receipt_lines_receipt
  ON tks_receipt_lines(receipt_id);

-- ===== 既存レシートからのバックフィル =====
-- lines が0件のレシートに対してのみ実行（再実行可能・冪等）
INSERT INTO tks_receipt_lines (
  receipt_id,
  line_no,
  tax_rate,
  amount_tax_incl,
  account_category,
  item_name
)
SELECT
  r.id,
  1,
  CASE
    WHEN r.tax_rate_category IN ('8', '10') THEN r.tax_rate_category::smallint
    ELSE 10
  END,
  COALESCE(r.amount, 0),
  COALESCE(r.account_category, '雑費'),
  r.description
FROM tks_receipts r
WHERE NOT EXISTS (
  SELECT 1 FROM tks_receipt_lines l WHERE l.receipt_id = r.id
);

COMMIT;

-- ===== 適用後の確認用クエリ =====
-- SELECT COUNT(*) AS receipts FROM tks_receipts;
-- SELECT COUNT(DISTINCT receipt_id) AS receipts_with_lines FROM tks_receipt_lines;
-- 両者が一致すれば全件バックフィル成功。
