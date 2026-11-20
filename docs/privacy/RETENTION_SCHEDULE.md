# Retention schedule & manual review process (BEST + BCC)

Status, Nov 2026: **nothing is deleted automatically.** This schedule is applied by a person, monthly, using `/dashboard/leads` and Supabase. Automation is a later step (see end).

## Schedule

| Data | Where | Keep | Clock starts | Exceptions (set "Keep (hold)" or note) |
|---|---|---|---|---|
| Private-experience inquiries | `bnt_experience_inquiries` | 24 months | Later of: submitted (`created_at`) or last status change by staff (`status_changed_at`) | Became a booking/client relationship still active; dispute or complaint; legal request → `retention_hold = true` |
| Contact messages | `bnt_contact_messages` | 24 months | Same as above | Same |
| Inquiry/contact alert emails | Gmail labels Leads/Private, Leads/Contact | Same as the record | — | Delete the email when the record is deleted |
| Waitlist sign-ups | `bnt_waitlist` | Until unsubscribe, or 24 months of inactivity | Later of: joined (`consented_at`) or last announcement (`notified_at`) | — |
| Unsubscribed waitlist entries | `bnt_waitlist` (unsubscribed_at set) | Suppression record [CONFIRM: proposal 24 months after unsubscribe, then delete] | `unsubscribed_at` | Sign-up is self-service only (no imports), so a long suppression list isn't needed to prevent re-mailing |
| Announcement history | `bnt_waitlist_announcements`, `bnt_waitlist_deliveries` | Deleted automatically with the subscriber (cascade); announcement rows kept as an approval record [CONFIRM] | — | — |
| Bookings, tickets, attendees, SMC registrations, OTA bookings | `bookings`, `booking_attendees`, `smc_registrations`, `ota_bookings` | Legal/accounting period [CONFIRM with accountant before publishing] | Booking/event date | Disputes, chargebacks, legal claims |
| Payment records | Stripe (their retention) + our references | As above | — | — |
| Email sending logs | Resend (their retention) | Provider-controlled | — | Mention in policy; not deletable per-record by us |
| Request logs | Vercel (≈1 hour on current plan) | Provider-controlled | — | — |
| Cookie choice | Visitor's browser (`snx_consent`) | 12 months | Choice made | — |

## Monthly review (≈15 minutes, first working day of the month)

1. Open **`/dashboard/leads`**. A yellow box lists every inquiry, contact message and waitlist address inactive for 24+ months that is not on hold.
2. For each one: if there's an active relationship, a dispute or a legal reason, press **Keep (hold)** and add a note on the inquiry. Otherwise press **Delete**.
3. In Gmail, search the label (e.g. `label:leads-private before:YYYY/MM/DD`, 24 months back) and delete those alert emails.
4. Waitlist: delete unsubscribed entries older than the suppression period you confirm.
5. Once a year (January): ask your accountant to confirm which bookings are past the legal period; delete or anonymise those in Supabase (see SQL below — run the SELECT first, export, then delete).
6. Record the date and counts in a simple log (Notion page or sheet): "Reviewed 1 Feb 2027 — deleted 3 inquiries, 1 contact, 0 waitlist; 1 on hold (dispute)".

### Read-only checks (Supabase SQL editor)

```sql
-- Inquiries/contacts due for review (not on hold)
select id, created_at, status_changed_at, name from bnt_experience_inquiries
 where not retention_hold and greatest(created_at, coalesce(status_changed_at, created_at)) < now() - interval '24 months';
select id, created_at, status_changed_at, name from bnt_contact_messages
 where not retention_hold and greatest(created_at, coalesce(status_changed_at, created_at)) < now() - interval '24 months';
-- Waitlist inactive 24 months
select id, email, consented_at, notified_at, unsubscribed_at from bnt_waitlist
 where greatest(coalesce(consented_at, created_at), coalesce(notified_at, created_at)) < now() - interval '24 months';
```

## Later automation (not built)

A scheduled job could run the same queries and email a monthly reminder, then later delete automatically once the periods are legally confirmed. Recommended only after one or two manual cycles.
