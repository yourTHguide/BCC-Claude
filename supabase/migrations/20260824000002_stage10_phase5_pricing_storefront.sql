-- Stage 10 Phase 5: tiered pricing (Early Bird / Regular) + storefront/tier
-- threading from checkout through Stripe metadata into bookings.
--
-- All columns additive and nullable, zero backfill -- every existing
-- product/booking keeps working identically to before this migration.
-- early_bird_price/early_bird_cutoff_hours are opt-in per product: a
-- product that never sets them (every BCC product today) is never touched
-- by the tiering branch in lib/pricing.ts's resolveEventPricing() -- it
-- always resolves 'regular' at the existing default_price/price_override,
-- byte-identical to pre-Phase-5 behavior.

ALTER TABLE public.products
  ADD COLUMN early_bird_price integer,
  ADD COLUMN early_bird_cutoff_hours integer,
  ADD CONSTRAINT products_early_bird_requires_cutoff
    CHECK (early_bird_price IS NULL OR early_bird_cutoff_hours IS NOT NULL);

COMMENT ON COLUMN public.products.early_bird_price IS
  'Optional discounted per-person THB price, available automatically until early_bird_cutoff_hours before each event''s effective start time. NULL = this product has no Early Bird tier.';
COMMENT ON COLUMN public.products.early_bird_cutoff_hours IS
  'Hours before an event''s effective start time at which Early Bird pricing stops being available. Required whenever early_bird_price is set.';

ALTER TABLE public.bookings
  ADD COLUMN storefront text,
  ADD CONSTRAINT bookings_storefront_check
    CHECK (storefront IS NULL OR storefront = ANY (ARRAY['bcc'::text, 'bnt'::text])),
  ADD COLUMN price_tier text,
  ADD CONSTRAINT bookings_price_tier_check
    CHECK (price_tier IS NULL OR price_tier = ANY (ARRAY['early_bird'::text, 'regular'::text]));

COMMENT ON COLUMN public.bookings.storefront IS
  'Which storefront (bcc/bnt) this booking''s checkout was resolved from, via the request''s own Host header at checkout time -- never client-supplied. NULL on bookings made before Stage 10 Phase 5 or via the legacy (non-dynamic) checkout path, which does not set this.';
COMMENT ON COLUMN public.bookings.price_tier IS
  'Which price tier (early_bird/regular) was authoritatively resolved server-side at checkout time for this booking. NULL on bookings made before Stage 10 Phase 5 or via the legacy checkout path.';
