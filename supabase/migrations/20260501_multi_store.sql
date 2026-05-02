-- Phase 1: Multi-store schema migration
-- Drops legacy single-org schema and rebuilds with stores + roles + approval workflow.
-- NOTE: RLS is NOT enabled in this migration. Current client uses Supabase anon key
-- with Firebase auth (no Supabase JWT), so naive RLS would block all queries.
-- RLS will be introduced in a later phase together with server-side API or JWT auth.

-- ===== Drop legacy tables =====
DROP TABLE IF EXISTS tks_audit_logs CASCADE;
DROP TABLE IF EXISTS tks_receipt_tags CASCADE;
DROP TABLE IF EXISTS tks_tags CASCADE;
DROP TABLE IF EXISTS tks_receipts CASCADE;
DROP TABLE IF EXISTS tks_projects CASCADE;
DROP TABLE IF EXISTS tks_clients CASCADE;
DROP TABLE IF EXISTS tks_staff CASCADE;
DROP TABLE IF EXISTS tks_users CASCADE;

-- ===== Stores =====
CREATE TABLE tks_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ===== Users =====
-- Roles: staff (店舗スタッフ・申請者), store_manager (店舗管理者・承認者), hq_accountant (本社経理)
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

-- ===== Receipts (申請) =====
-- status flow: pending -> approved (by store_manager) -> paid (by hq_accountant)
--                     -> rejected (by store_manager)
CREATE TABLE tks_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES tks_stores(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),

  -- 申請内容
  date date,
  payee text,
  amount integer,
  tax_amount integer,
  tax_rate_category text CHECK (tax_rate_category IN ('8', '10', 'mixed')),
  account_category text,
  description text,
  invoice_registration_no text,
  purpose text,         -- 目的（紙様式）
  participants text,    -- 参加者（紙様式）
  image_url text NOT NULL,

  -- AI読取
  ai_raw_response jsonb,
  ai_confidence numeric,
  is_ai_verified boolean DEFAULT false,

  -- 承認・支払い
  approved_by uuid REFERENCES tks_users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejection_reason text,
  paid_at timestamptz,

  -- 監査
  created_by uuid REFERENCES tks_users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES tks_users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_receipts_store_status ON tks_receipts(store_id, status);
CREATE INDEX idx_receipts_created_by ON tks_receipts(created_by);
CREATE INDEX idx_receipts_dup ON tks_receipts(date, payee, amount);

-- ===== Tags (unchanged structure) =====
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

-- ===== Audit log (unchanged structure) =====
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
INSERT INTO tks_users (email, role, status, invite_code)
VALUES ('rio.oishi@randd-inc.com', 'hq_accountant', 'pending', 'initial-hq-setup');
