-- OTA report import: store each platform's own booking reference and money
-- breakdown on ota_bookings, so finance can match a booking to its payout
-- and an uploaded report can never insert the same booking twice.
ALTER TABLE public.ota_bookings
  ADD COLUMN IF NOT EXISTS booking_ref   text,          -- Airbnb confirmation code, GYG…, Viator reference
  ADD COLUMN IF NOT EXISTS gross_amount  numeric(12,2), -- what the guest paid the platform (when the report has it)
  ADD COLUMN IF NOT EXISTS platform_fee  numeric(12,2), -- platform commission
  ADD COLUMN IF NOT EXISTS payout_ref    text,          -- platform payout / transfer reference
  ADD COLUMN IF NOT EXISTS payout_date   date,
  ADD COLUMN IF NOT EXISTS booked_on     date,
  ADD COLUMN IF NOT EXISTS imported_at   timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS ota_bookings_source_booking_ref_key
  ON public.ota_bookings (source, booking_ref)
  WHERE booking_ref IS NOT NULL;

-- GYG codes already typed into notes (Halloween import) become real refs.
UPDATE public.ota_bookings
SET booking_ref = substring(notes from 'GYG[A-Z0-9]{8,}')
WHERE source = 'getyourguide' AND booking_ref IS NULL AND notes ~ 'GYG[A-Z0-9]{8,}';
