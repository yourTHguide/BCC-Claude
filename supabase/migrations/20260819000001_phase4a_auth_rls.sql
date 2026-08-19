-- ============================================================
-- PHASE 4 · MIGRATION A — Auth boundary + RLS on products + products.updated_at
-- ============================================================
-- Intended stage: STAGE 1 (Supabase Auth admin boundary).
-- Status: AUTHORED in Stage 0 — NOT yet applied to production (2026-08-19).
--
-- Idempotent and ADDITIVE. It does not alter or drop any existing column or
-- row. Safe to run once on a fresh environment or (later) on production.
--
-- Why each object exists:
--   • admin_users        — authorization table keyed to Supabase Auth users, so
--                          /dashboard and /api/admin/* can verify "is this a
--                          signed-in admin?" server-side. `role` is future-proofed
--                          for staff tiers without redesigning auth.
--   • products.updated_at— edit tracking for the admin CRUD surface (products had
--                          only created_at).
--   • products RLS ON    — products currently has RLS DISABLED (Supabase advisor
--                          ERROR: anon/authenticated hold full CRUD grants). We
--                          make products a write target in Phase 4, so lock it to
--                          the service role. Nothing client-side reads products
--                          via the anon key (verified: /book uses /api/events,
--                          which runs server-side with the service role).
-- ============================================================

-- ── admin_users ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'owner'
    CHECK (role IN ('owner','admin','staff')),
  display_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- A signed-in user may read ONLY their own admin row (lets the browser ask
-- "am I an admin, and what role?"). The service role bypasses RLS for the
-- authoritative server-side check. No INSERT/UPDATE/DELETE policies: admin rows
-- are provisioned via the service role / Supabase dashboard only.
DROP POLICY IF EXISTS "admin_users self read" ON admin_users;
CREATE POLICY "admin_users self read" ON admin_users
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ── products.updated_at + auto-touch trigger ────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Shared BEFORE-UPDATE touch function (reused by later Phase 4 tables).
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $fn$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_set_updated_at ON products;
CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Enable RLS on products (no policies: service role only) ─
-- Service-role clients (/api/events, /api/create-checkout, the Phase 4 admin
-- API) bypass RLS. With RLS enabled and no policy, anon/authenticated are
-- denied regardless of the lingering table grants — closing the advisor ERROR.
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
