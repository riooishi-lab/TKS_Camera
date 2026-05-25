-- ============================================================
-- Phase 5: 承認ステータス簡素化 (4段階 → 3段階)
-- ------------------------------------------------------------
-- 打ち合わせFB反映: 社長は承認フローから外れ、閲覧/横断レポートのみ可能に。
-- 旧フロー: pending → manager_approved → accountant_approved → approved → paid
-- 新フロー: pending → manager_approved → accountant_approved → paid
--
-- 'approved' ステータスを廃止し、既存データは accountant_approved に集約する。
--
-- 注意:
--   - president_approved_by / president_approved_at 列は今フェーズでは残置する
--     （本番運用が安定してから別マイグレーションで物理削除する想定）
-- ============================================================

BEGIN;

-- 旧 CHECK 制約を外す
ALTER TABLE tks_receipts
  DROP CONSTRAINT IF EXISTS tks_receipts_status_check;

-- データ移行: approved → accountant_approved
UPDATE tks_receipts
  SET status = 'accountant_approved'
  WHERE status = 'approved';

-- 新 CHECK 制約を付ける
ALTER TABLE tks_receipts
  ADD CONSTRAINT tks_receipts_status_check
  CHECK (status IN (
    'pending',
    'manager_approved',
    'accountant_approved',
    'paid',
    'rejected'
  ));

COMMIT;

-- ===== 適用後の確認用クエリ =====
-- SELECT status, count(*) FROM tks_receipts GROUP BY status;
