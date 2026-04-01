-- RLS（行レベルセキュリティ）を有効化
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- ヘルパー関数: 現在のユーザーの組織IDを取得
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id FROM profiles
  WHERE id = auth.uid() AND deleted_at IS NULL
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ===== Organizations =====
CREATE POLICY "Users can view own organization"
  ON organizations FOR SELECT
  USING (id = get_user_organization_id() AND deleted_at IS NULL);

CREATE POLICY "Users can update own organization"
  ON organizations FOR UPDATE
  USING (id = get_user_organization_id() AND deleted_at IS NULL);

-- ===== Profiles =====
CREATE POLICY "Users can view org members"
  ON profiles FOR SELECT
  USING (organization_id = get_user_organization_id() AND deleted_at IS NULL);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- ===== Projects =====
CREATE POLICY "Users can view org projects"
  ON projects FOR SELECT
  USING (organization_id = get_user_organization_id() AND deleted_at IS NULL);

CREATE POLICY "Users can create org projects"
  ON projects FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update org projects"
  ON projects FOR UPDATE
  USING (organization_id = get_user_organization_id());

-- ===== Receipts =====
CREATE POLICY "Users can view org receipts"
  ON receipts FOR SELECT
  USING (organization_id = get_user_organization_id() AND deleted_at IS NULL);

CREATE POLICY "Users can create org receipts"
  ON receipts FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update org receipts"
  ON receipts FOR UPDATE
  USING (organization_id = get_user_organization_id());
