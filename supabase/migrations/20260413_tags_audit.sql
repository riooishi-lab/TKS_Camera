-- Tags
CREATE TABLE IF NOT EXISTS tks_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text,
  created_at timestamptz DEFAULT now()
);

-- Receipt <-> Tag (many-to-many)
CREATE TABLE IF NOT EXISTS tks_receipt_tags (
  receipt_id uuid NOT NULL REFERENCES tks_receipts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tks_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (receipt_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_receipt_tags_tag_id ON tks_receipt_tags(tag_id);

-- Receipt authorship for audit
ALTER TABLE tks_receipts
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES tks_users(id),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES tks_users(id);

-- Audit log
CREATE TABLE IF NOT EXISTS tks_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  changed_by uuid REFERENCES tks_users(id),
  changed_at timestamptz DEFAULT now(),
  diff jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON tks_audit_logs(entity_type, entity_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at
  ON tks_audit_logs(changed_at DESC);

-- Useful index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_receipts_dup
  ON tks_receipts(date, payee, amount);
