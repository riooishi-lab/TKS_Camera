-- Notifications: 承認ワークフローの各イベント（申請・承認・差戻し・再申請・支払）を
-- 関係者に通知するためのアプリ内通知テーブル。
-- メール送信は別途 Route Handler 経由（RESEND_API_KEY 設定時のみ）で行う。

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

-- 受信者ごとの未読取得・新着順表示を高速化
CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON tks_notifications(recipient_id, is_read, created_at DESC);
