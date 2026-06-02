-- ============================================================
-- 一度ききりの本番DB修復スクリプト その3（Phase 5 新テーブルの RLS 無効化）
-- ------------------------------------------------------------
-- 背景:
--   repair-rls.sql は旧テーブルの RLS のみ無効化しており、Phase 5 で
--   新設した以下のテーブルが漏れていた。新テーブルは RLS が有効な状態で
--   残っており、anonキー + Firebase認証（Supabase JWT 無し）のクライアントが
--   書き込めず "new row violates row-level security policy" で弾かれていた。
--
--   - tks_receipt_lines               … レシート明細（登録時に必ず INSERT する）
--   - tks_cash_replenishment_requests … 現金補充申請
--
-- 設計方針は repair-rls.sql と同じく「RLS は意図的にオフ」
-- （20260501_multi_store.sql 冒頭コメント参照）。RLS導入は別フェーズ。
--
-- 実行方法: Supabase Dashboard → SQL Editor に貼り付けて Run。
-- 冪等（何度実行しても安全）。
-- ============================================================

BEGIN;

ALTER TABLE IF EXISTS tks_receipt_lines
  DISABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS tks_cash_replenishment_requests
  DISABLE ROW LEVEL SECURITY;

COMMIT;

-- ===== 確認用クエリ（実行後に rowsecurity が全て false になっていること） =====
-- SELECT relname, relrowsecurity
-- FROM pg_class
-- WHERE relname IN ('tks_receipt_lines', 'tks_cash_replenishment_requests');
