-- ============================================================
-- Phase 5: ロール再編 (staff → store_staff)
-- ------------------------------------------------------------
-- 打ち合わせFB反映: 個人スタッフの概念を廃止し、
-- すべてのレシートは「店舗が使った経費」または「店長立替経費」のいずれかとする。
-- 旧 'staff' ロールを 'store_staff' にリネームする。
--
-- 既存データ:
--   - role='staff' の全行を 'store_staff' に UPDATE
--   - CHECK 制約を新4ロール ('store_staff','store_manager','hq_accountant','president') に差し替え
-- ============================================================

BEGIN;

-- 旧 CHECK 制約を外す
ALTER TABLE tks_users
  DROP CONSTRAINT IF EXISTS tks_users_role_check;

-- データ移行: staff → store_staff
UPDATE tks_users
  SET role = 'store_staff'
  WHERE role = 'staff';

-- 新 CHECK 制約を付ける
ALTER TABLE tks_users
  ADD CONSTRAINT tks_users_role_check
  CHECK (role IN ('store_staff', 'store_manager', 'hq_accountant', 'president'));

-- DEFAULT 値も新ロールに合わせる
ALTER TABLE tks_users
  ALTER COLUMN role SET DEFAULT 'store_staff';

COMMIT;

-- ===== 適用後の確認用クエリ =====
-- SELECT role, count(*) FROM tks_users GROUP BY role;
