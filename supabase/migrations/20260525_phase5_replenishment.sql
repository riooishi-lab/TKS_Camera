-- ============================================================
-- Phase 5: 小口現金補充申請テーブル
-- ------------------------------------------------------------
-- 打ち合わせFB反映:
--   店舗から本社への翌月分小口現金補充希望を、メール運用から
--   システム内ワークフローに置き換える。
--
-- ステータス遷移:
--   pending → approved → fulfilled  （承認 → 現金手渡し記録）
--   pending → rejected               （差戻し）
--
-- 同一 (store_id, target_month) で複数申請を許容（追加申請ケース）。
-- target_month は対象月の月初日で正規化（例: 2026-06 → 2026-06-01）。
-- 承認後、本社が「現金支給済み」を押すと tks_cash_deposits 行を作成し
-- fulfilled_deposit_id で紐付ける（残高計算と一貫させる）。
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS tks_cash_replenishment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES tks_stores(id) ON DELETE CASCADE,
  target_month date NOT NULL,
  requested_amount integer NOT NULL CHECK (requested_amount > 0),
  reason text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled')),
  requested_by uuid REFERENCES tks_users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES tks_users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  fulfilled_deposit_id uuid REFERENCES tks_cash_deposits(id) ON DELETE SET NULL,
  rejection_reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_replenish_store_month
  ON tks_cash_replenishment_requests(store_id, target_month);
CREATE INDEX IF NOT EXISTS idx_replenish_status
  ON tks_cash_replenishment_requests(status, requested_at DESC);

COMMIT;
