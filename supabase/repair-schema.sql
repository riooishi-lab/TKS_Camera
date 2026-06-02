-- ============================================================
-- 一度ききりの本番DB修復スクリプト（破壊的）
-- ------------------------------------------------------------
-- 本番Supabaseは 20260403_init の旧スキーマのまま停止しており、
-- 20260501_multi_store / 20260502_phase4 が未適用。
-- このスクリプトは未適用マイグレーションを順に適用してコードと一致させる。
--
-- 【破壊的】既存の tks_receipts / tks_audit_logs / tks_notifications
--           などの全データを削除して作り直す。
--
-- 実行方法: Supabase Dashboard → SQL Editor に貼り付けて Run。
-- 全体を1トランザクションで実行する（途中失敗時は全ロールバック）。
--
-- 標準シードとの相違点:
--   初期ユーザー rio.oishi@randd-inc.com を、既存の Firebase UID を
--   引き継いで role=hq_accountant / status=active で作成する。
--   （マイグレーション完了後もログインが切れないようにするため）
-- ============================================================

BEGIN;

-- ===== 旧テーブルを全削除 =====
DROP TABLE IF EXISTS tks_notifications CASCADE;
DROP TABLE IF EXISTS tks_cash_deposits CASCADE;
DROP TABLE IF EXISTS tks_audit_logs CASCADE;
DROP TABLE IF EXISTS tks_receipt_tags CASCADE;
DROP TABLE IF EXISTS tks_tags CASCADE;
DROP TABLE IF EXISTS tks_receipts CASCADE;
DROP TABLE IF EXISTS tks_projects CASCADE;
DROP TABLE IF EXISTS tks_clients CASCADE;
DROP TABLE IF EXISTS tks_staff CASCADE;
DROP TABLE IF EXISTS tks_stores CASCADE;
DROP TABLE IF EXISTS tks_users CASCADE;

-- ============================================================
-- 20260501_multi_store.sql
-- ============================================================

-- ===== Stores =====
CREATE TABLE tks_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ===== Users =====
CREATE TABLE tks_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text UNIQUE,
  email text NOT NULL UNIQUE,
  name text,
  role text NOT NULL DEFAULT 'staff'
    CHECK (role IN ('staff', 'store_manager', 'hq_accountant')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active')),
  store_id uuid REFERENCES tks_stores(id) ON DELETE SET NULL,
  invite_code text UNIQUE,
  invited_by uuid REFERENCES tks_users(id),
  created_at timestamptz DEFAULT now()
);

-- ===== Receipts =====
CREATE TABLE tks_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES tks_stores(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  date date,
  payee text,
  amount integer,
  tax_amount integer,
  tax_rate_category text CHECK (tax_rate_category IN ('8', '10', 'mixed')),
  account_category text,
  description text,
  invoice_registration_no text,
  purpose text,
  participants text,
  image_url text NOT NULL,
  ai_raw_response jsonb,
  ai_confidence numeric,
  is_ai_verified boolean DEFAULT false,
  approved_by uuid REFERENCES tks_users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejection_reason text,
  paid_at timestamptz,
  created_by uuid REFERENCES tks_users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES tks_users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_receipts_store_status ON tks_receipts(store_id, status);
CREATE INDEX idx_receipts_created_by ON tks_receipts(created_by);
CREATE INDEX idx_receipts_dup ON tks_receipts(date, payee, amount);

-- ===== Tags =====
CREATE TABLE tks_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE tks_receipt_tags (
  receipt_id uuid NOT NULL REFERENCES tks_receipts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tks_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (receipt_id, tag_id)
);

CREATE INDEX idx_receipt_tags_tag_id ON tks_receipt_tags(tag_id);

-- ===== Audit log =====
CREATE TABLE tks_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  changed_by uuid REFERENCES tks_users(id),
  changed_at timestamptz DEFAULT now(),
  diff jsonb
);

CREATE INDEX idx_audit_logs_entity
  ON tks_audit_logs(entity_type, entity_id, changed_at DESC);
CREATE INDEX idx_audit_logs_changed_at
  ON tks_audit_logs(changed_at DESC);

-- ===== Initial stores =====
INSERT INTO tks_stores (name) VALUES
  ('渋谷店'),
  ('新宿店'),
  ('池袋店');

-- ===== Initial HQ accountant user =====
-- 標準シードと異なり、既存の Firebase UID を引き継いで active で作成する。
INSERT INTO tks_users (firebase_uid, email, name, role, status, invite_code)
VALUES (
  'BZiGH0uUmXhd3cGKJxOk2s2fQIm2',
  'rio.oishi@randd-inc.com',
  '大石理央',
  'hq_accountant',
  'active',
  'initial-hq-setup'
);

-- ============================================================
-- 20260502_phase4.sql
-- ============================================================

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

-- ===== 4. Migrate legacy 2-stage approval data (新規作成のため対象0件) =====
UPDATE tks_receipts
  SET status = 'manager_approved',
      manager_approved_by = approved_by,
      manager_approved_at = approved_at
  WHERE status = 'approved';

-- ===== 5. Drop legacy approval columns =====
ALTER TABLE tks_receipts
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS approved_at;

-- ===== 6. Cash deposits =====
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

-- ============================================================
-- 20260521_notifications.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS tks_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES tks_users(id) ON DELETE CASCADE,
  type text NOT NULL,
  receipt_id uuid REFERENCES tks_receipts(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON tks_notifications(recipient_id, is_read, created_at DESC);

COMMIT;
