-- pg_trgm拡張を有効化（トライグラム検索用）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Receipts (レシート/領収書)
CREATE TABLE receipts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations(id),
  uploaded_by              UUID NOT NULL REFERENCES profiles(id),

  -- AI抽出/ユーザー編集フィールド
  date                     DATE,
  payee                    TEXT,
  amount                   INTEGER,
  tax_amount               INTEGER,
  tax_rate_category        TEXT CHECK (tax_rate_category IN ('8', '10', 'mixed')),
  account_category         TEXT,
  description              TEXT,
  invoice_registration_no  TEXT,
  project_id               UUID REFERENCES projects(id),
  person_in_charge         TEXT,

  -- 画像
  image_url                TEXT NOT NULL,
  image_path               TEXT NOT NULL,

  -- AIメタデータ
  ai_raw_response          JSONB,
  ai_confidence            REAL,
  is_ai_verified           BOOLEAN NOT NULL DEFAULT false,

  -- タイムスタンプ
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at               TIMESTAMPTZ
);

-- インデックス
CREATE INDEX idx_receipts_organization_id ON receipts(organization_id);
CREATE INDEX idx_receipts_uploaded_by ON receipts(uploaded_by);
CREATE INDEX idx_receipts_date ON receipts(date);
CREATE INDEX idx_receipts_payee ON receipts USING gin(payee gin_trgm_ops);
CREATE INDEX idx_receipts_account_category ON receipts(account_category);
CREATE INDEX idx_receipts_project_id ON receipts(project_id);
CREATE INDEX idx_receipts_person_in_charge ON receipts(person_in_charge);
CREATE INDEX idx_receipts_description ON receipts USING gin(description gin_trgm_ops);
