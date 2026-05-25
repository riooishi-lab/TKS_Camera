-- ============================================================
-- Phase 5: tks_receipts への追加カラム
-- ------------------------------------------------------------
-- 打ち合わせFB反映で必要になった以下の属性を追加する。
--
--   submitted_at    timestamptz   申請登録日（伝票日付と異なる月の場合 = 遅延申請）
--   expense_type    text          'petty_cash'(小口) / 'personal'(店長立替)
--   invoice_status  text          'registered' / 'unregistered' / 'unknown'
--   item_name       text          品目名（旧 participants の役割を置換、AI抽出対象）
--   image_metadata  jsonb         画像メタ情報（電帳法対応の予約列）
--
-- 既存行のデータ移行:
--   submitted_at   = created_at
--   expense_type   = 'petty_cash'
--   invoice_status = invoice_registration_no IS NOT NULL ? 'registered' : 'unknown'
--   item_name      = NULL（既存 description から推測しない、明示的に NULL のまま）
--   image_metadata = NULL
-- ============================================================

BEGIN;

ALTER TABLE tks_receipts
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS expense_type text NOT NULL DEFAULT 'petty_cash',
  ADD COLUMN IF NOT EXISTS invoice_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS item_name text,
  ADD COLUMN IF NOT EXISTS image_metadata jsonb;

-- CHECK 制約（IF NOT EXISTS が無いため、存在しない場合のみ追加）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tks_receipts_expense_type_check'
  ) THEN
    ALTER TABLE tks_receipts
      ADD CONSTRAINT tks_receipts_expense_type_check
      CHECK (expense_type IN ('petty_cash', 'personal'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tks_receipts_invoice_status_check'
  ) THEN
    ALTER TABLE tks_receipts
      ADD CONSTRAINT tks_receipts_invoice_status_check
      CHECK (invoice_status IN ('registered', 'unregistered', 'unknown'));
  END IF;
END $$;

-- 既存行のデータ移行
UPDATE tks_receipts
SET submitted_at = created_at
WHERE submitted_at IS NULL;

UPDATE tks_receipts
SET invoice_status = CASE
  WHEN invoice_registration_no IS NOT NULL AND invoice_registration_no <> '' THEN 'registered'
  ELSE 'unknown'
END
WHERE invoice_status = 'unknown';

COMMIT;

-- ===== 適用後の確認用クエリ =====
-- SELECT
--   COUNT(*) FILTER (WHERE submitted_at IS NULL)    AS null_submitted_at,
--   COUNT(*) FILTER (WHERE expense_type IS NULL)    AS null_expense_type,
--   COUNT(*) FILTER (WHERE invoice_status IS NULL)  AS null_invoice_status
-- FROM tks_receipts;
-- 全て0であること。
