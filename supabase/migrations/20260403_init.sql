-- Clients
CREATE TABLE IF NOT EXISTS tks_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Staff
CREATE TABLE IF NOT EXISTS tks_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Projects
CREATE TABLE IF NOT EXISTS tks_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  client_id uuid REFERENCES tks_clients(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Users
CREATE TABLE IF NOT EXISTS tks_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text UNIQUE,
  email text NOT NULL UNIQUE,
  name text,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  invite_code text UNIQUE,
  invited_by uuid REFERENCES tks_users(id),
  created_at timestamptz DEFAULT now()
);

-- Receipts
CREATE TABLE IF NOT EXISTS tks_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date,
  payee text,
  amount integer,
  tax_amount integer,
  tax_rate_category text CHECK (tax_rate_category IN ('8', '10', 'mixed')),
  account_category text,
  description text,
  invoice_registration_no text,
  project_id uuid REFERENCES tks_projects(id),
  client_id uuid REFERENCES tks_clients(id),
  person_in_charge text,
  image_url text NOT NULL,
  ai_raw_response jsonb,
  ai_confidence numeric,
  is_ai_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert initial admin user
INSERT INTO tks_users (email, role, status, invite_code)
VALUES ('rio.oishi@randd-inc.com', 'admin', 'pending', 'initial-admin-setup');
