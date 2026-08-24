-- Stage 10 Phase 3: canonical BNT inquiry/contact tables.
-- Denormalized (name/whatsapp stored directly on the row), matching this
-- project's own `bookings` table convention (guest_name/guest_email/
-- guest_phone inline, no separate guests table) rather than the old
-- NightlifeAntigravity guests+experience_inquiries dedup model. No
-- continuity with the old Nightlife Supabase project's rows.

CREATE TABLE public.bnt_experience_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  whatsapp text NOT NULL,
  occasion text,
  event_date date,
  is_flexible_date boolean NOT NULL DEFAULT false,
  group_size text,
  preferred_vibe text,
  budget_range text,
  inquiry_type text NOT NULL DEFAULT 'Private Inquiry'
);

CREATE TABLE public.bnt_contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  whatsapp text NOT NULL,
  message text
);

-- RLS enabled, no policies -- service-role only, same posture as
-- product_content/product_media/admin_users.
ALTER TABLE public.bnt_experience_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bnt_contact_messages ENABLE ROW LEVEL SECURITY;
