-- ============================================================
-- 一度ききりの本番DB修復スクリプト その2（RLS無効化 + シード再投入）
-- ------------------------------------------------------------
-- repair-schema.sql 適用後、新テーブルに RLS（行レベルセキュリティ）が
-- 有効化されており、anonキーで動くクライアントが読み書きできない状態。
--
-- 現状の設計は RLS を意図的にオフにする方針（20260501_multi_store.sql の
-- 冒頭コメント参照: anonキー + Firebase認証で Supabase JWT が無いため、
-- RLS を付けると全クエリが弾かれる。RLS導入は別フェーズ）。
--
-- このスクリプトは:
--   1. 全テーブルの RLS を無効化する
--   2. シード（店舗3件・初期ユーザー）が未投入なら投入する（冪等）
--
-- 実行方法: Supabase Dashboard → SQL Editor に貼り付けて Run。
-- ============================================================

BEGIN;

-- ===== 1. RLS を無効化 =====
ALTER TABLE tks_stores        DISABLE ROW LEVEL SECURITY;
ALTER TABLE tks_users         DISABLE ROW LEVEL SECURITY;
ALTER TABLE tks_receipts      DISABLE ROW LEVEL SECURITY;
ALTER TABLE tks_tags          DISABLE ROW LEVEL SECURITY;
ALTER TABLE tks_receipt_tags  DISABLE ROW LEVEL SECURITY;
ALTER TABLE tks_audit_logs    DISABLE ROW LEVEL SECURITY;
ALTER TABLE tks_cash_deposits DISABLE ROW LEVEL SECURITY;
ALTER TABLE tks_notifications DISABLE ROW LEVEL SECURITY;

-- ===== 2. シード再投入（冪等: 既に入っていれば何もしない） =====

-- 店舗: テーブルが空のときだけ3件投入
INSERT INTO tks_stores (name)
SELECT v.name
FROM (VALUES ('渋谷店'), ('新宿店'), ('池袋店')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM tks_stores);

-- 初期ユーザー: email一意。既存行があっても正しい値に揃える。
INSERT INTO tks_users (firebase_uid, email, name, role, status, invite_code)
VALUES (
  'BZiGH0uUmXhd3cGKJxOk2s2fQIm2',
  'rio.oishi@randd-inc.com',
  '大石理央',
  'hq_accountant',
  'active',
  'initial-hq-setup'
)
ON CONFLICT (email) DO UPDATE SET
  firebase_uid = EXCLUDED.firebase_uid,
  name         = EXCLUDED.name,
  role         = EXCLUDED.role,
  status       = EXCLUDED.status;

COMMIT;

-- ===== 確認用クエリ（実行後に結果を確認） =====
SELECT 'stores' AS tbl, count(*) FROM tks_stores
UNION ALL
SELECT 'users',  count(*) FROM tks_users;
