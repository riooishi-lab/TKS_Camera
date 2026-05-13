-- Phase 4: Multi-stage approval (店舗管理者 → 経理 → 社長), payment tracking, cash deposits
-- Builds on top of 20260501_multi_store.sql

-- ===== 1. Add president role =====
ALTER TABLE tks_users
  DROP CONSTRAINT IF EXISTS tks_users_role_check;
ALTER TABLE tks_users
  ADD CONSTRAINT tks_users_role_check
  CHECK (role IN ('staff', 'store_manager', 'hq_accountant', 'president'));

-- ===== 2. Extend receipt status enum =====
ALTER TABLE tks_receipts
  DROP CONSTRAINT IF EXISTS tks_receipts_status_check;
ALTER TABLE tks_receipts
  ADD CONSTRAINT tks_receipts_status_check
  CHECK (status IN (
    'pending',
    'manager_approved',
    'accountant_approved',
    'approved',
    'paid',
    'rejected'
  ));

-- ===== 3. Add multi-stage approval columns =====
ALTER TABLE tks_receipts
  ADD COLUMN IF NOT EXISTS manager_approved_by uuid REFERENCES tks_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manager_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS accountant_approved_by uuid REFERENCES tks_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accountant_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS president_approved_by uuid REFERENCES tks_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS president_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES tks_users(id) ON DELETE SET NULL;

-- ===== 4. Migrate legacy 2-stage approval data (if any) =====
-- Old 'approved' = store_manager approval = new 'manager_approved'
UPDATE tks_receipts
  SET status = 'manager_approved',
      manager_approved_by = approved_by,
      manager_approved_at = approved_at
  WHERE status = 'approved';

-- ===== 5. Drop legacy approval columns =====
ALTER TABLE tks_receipts
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS approved_at;

-- ===== 6. Cash deposits (補充金 / 前月繰越金) =====
CREATE TABLE IF NOT EXISTS tks_cash_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES tks_stores(id) ON DELETE CASCADE,
  date date NOT NULL,
  amount integer NOT NULL,
  description text,
  created_by uuid REFERENCES tks_users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_deposits_store_date
  ON tks_cash_deposits(store_id, date);
