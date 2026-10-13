-- Applied to STAGING (jyhtznpethgzypblppnt) as migration "baseline_02c_admin_users_updated_at".
-- Source: see supabase/staging/README.md. Do not run against production.
CREATE TABLE IF NOT EXISTS admin_users (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'owner'
    CHECK (role IN ('owner','admin','staff')),
  display_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_users self read" ON admin_users
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$fn$;
CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
