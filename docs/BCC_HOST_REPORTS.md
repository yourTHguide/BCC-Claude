# Host after-event report, expenses and payout (Nov 2026)

Owner decisions (27 Nov 2026):
- The owner sets the host fee **after** reviewing check-ins and approving expenses (suggested fee from check-ins shown, as in Closeout).
- Incidents email the owner straight away.
- Guest notes: blank comment box + quick tags the host can ask about on the night (🧳 still travelling + next stop, 🔁 coming back, 🍾 VIP interest, 🎉 other events, ⭐ great guest, ⚠ issue). Internal service notes; not used for marketing without separate consent.
- Venues: one short comment per venue (no star ratings).
- No deadline; a night's pay is only ready once its report is submitted.

## As built
- Migration `20261129000001_host_reports.sql`: `host_reports` (one per night, draft → submitted, guests/venues/incidents as JSON), `host_expenses` (pending → approved/rejected, receipt path), private storage bucket `host-receipts` (images/PDF, 5 MB). RLS on, service role only. Rollback in `supabase/rollback/` (refuses while rows exist). Applied to staging 27 Nov.
- **Host night page** (`/dashboard/host/<night>`): tabs **Brief** (read-only), **Guests** (door list, check-in, Scan), **Expenses** (amount, category, note, receipt photo/PDF ≤ 4 MB; status Waiting / Approved / Rejected; remove own pending), **Report** (autosaves a draft, opens on the night itself, **Submit** locks it; incident email to `ADMIN_NOTIFY_EMAIL`, host text escaped).
- **Host landing**: "Reports to write" first, then **My earnings (hosting)**: per night fee (once set), approved expenses, total, state *Report due → Report in — owner reviewing → Ready to pay → Paid*. Commission stays under "My invites & commission". No prices or revenue.
- **Owner** `/dashboard/reports` (📝 in the menu): To do / All nights; night review with incidents, vibe, venues, guest notes, expenses (Approve / Reject with reason, receipt link), fee (Save / Use suggested) and **Mark paid** (only when the report is submitted, the fee is set and no expense is waiting). Uses `event_dates.host_fee_final` / `host_payment_status`, the same fields as Closeout.
- Approved host expenses are copied into `expenses` (taxi/other → extra, drinks → drinks, entry → cover_charge, van → van), so Operations and Closeout totals only include approved ones.
- Privacy notice: rows for host notes (purpose, legitimate interest, not for marketing) and retention (24 months; incidents as long as needed).

## Preview test
1. Calendar → a past night (e.g. 26 Nov) → assign yourself as host.
2. Host view → All nights → open it → Expenses: add one with a receipt photo; Report: fill in, add an incident, Submit (incident email arrives at bangkokclubcrawl@gmail.com).
3. 📝 Reports → the night → approve/reject, Use suggested fee, Mark paid. Host view → My earnings shows the state at each step.
