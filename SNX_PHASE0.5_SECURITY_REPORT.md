# SNX Phase 0.5 — Security Pass (RLS Only)

Date: 2026-09-01
Scope: `bookings`, `event_dates`, `expenses`, `ota_bookings` only. No code, schema, or routing changes made. No Partners/Proposals/Hermes work. No `/operator` scaffolding.
Method: queried the live production database directly (Supabase project `oomhftxgvikzxlvqdcmr`, "BCC - Claude") via `pg_class`, `pg_policies`, `pg_roles`, and `information_schema.role_table_grants` — not the local `supabase-schema.sql` file — because [BCC_EXISTING_OPERATIONS_AUDIT.md](./BCC_EXISTING_OPERATIONS_AUDIT.md) and the schema file were the only prior sources, and they disagree with production.

## Headline finding: the committed audit's "Critical" RLS claim does not match live production

`BCC_EXISTING_OPERATIONS_AUDIT.md` §2 states these four tables have "permissive public `SELECT` policies," rated Critical. That was based on reading `supabase-schema.sql`, which contains `CREATE POLICY ... USING (true)` statements for all four tables and a comment claiming they reflect "production."

Live production does not have those policies. It has none at all.

## 1. Current policy summary (live, verified)

| Table | RLS enabled | Policies present | `anon`/`authenticated` table grants | Effective access for anon/authenticated |
|---|---|---|---|---|
| `bookings` | Yes | **0** | Full (SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER) | **Denied** — RLS blocks every row, every command |
| `event_dates` | Yes | **0** | Full | **Denied** |
| `expenses` | Yes | **0** | Full | **Denied** |
| `ota_bookings` | Yes | **0** | Full | **Denied** |

Confirmed via Supabase's own security advisor (`get_advisors`, type `security`): each table shows `rls_enabled_no_policy` — RLS on, zero policies.

Why "denied" and not "error": Postgres RLS with zero policies for a role/command defaults to deny. The blanket `anon`/`authenticated` GRANTs exist (probably from Supabase's default bootstrap or an early migration) but are inert — RLS sits in front of them and blocks everything for both roles, on every command.

`service_role` and `postgres` both carry `BYPASSRLS` — they ignore RLS entirely, which is how the app currently works at all.

## 2. Does anything currently rely on anon-key access to these tables?

No. Every reference to `.from('bookings')`, `.from('event_dates')`, `.from('expenses')`, `.from('ota_bookings')` in the codebase (~40 call sites across `app/api/**` and `lib/bookingResolution.ts`) runs through `getServiceSupabase()` in `lib/supabase.ts`, which uses `SUPABASE_SERVICE_ROLE_KEY`. That key bypasses RLS by design.

The two anon-key clients that exist in the codebase — `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (cookie-bound SSR) — are both explicitly commented `// Not imported anywhere yet — scaffolding for the Stage 1 auth boundary.` Neither is wired into any route yet.

So: production is already effectively locked down on these four tables, and nothing in the app depends on it being otherwise.

## 3. The actual risk: a landmine in the repo, not a hole in production

`supabase-schema.sql` still contains the permissive `CREATE POLICY ... FOR SELECT TO public USING (true)` statements for all four tables, prefaced with a comment claiming this is what production runs. It is not. If that file is ever re-applied to production — a "resync schema to match the file" cleanup, a disaster-recovery restore, spinning up a review/staging project from this file — it would silently open all four tables to full public read via the anon key, because the blanket `anon`/`authenticated` GRANTs are already sitting there ready to be activated by exactly that kind of policy.

This is the real Phase 0.5 finding: the danger isn't current production state, it's a stale file that documents and would recreate the wrong state.

## 4. Proposed changes

### 4a. Required before `/operator/records` (repo-only, zero production impact)

Fix `supabase-schema.sql` so it reflects and can only reproduce the actual deny-by-default posture — replace the four `CREATE POLICY ... USING (true)` blocks (lines ~223–252) with a comment stating RLS is enabled with no policies by design, service-role access only. This removes the landmine without touching the live database at all.

I have not made this edit — it touches a file the architecture doc didn't scope me to change without confirmation, and it should probably happen alongside a correction to the committed audit's Critical finding, which is a call I'm flagging for you rather than making unilaterally.

### 4b. Optional, not required — future `/operator/records` read path

If `/operator/records` is ever built to query these tables directly via the SSR anon-key client (`createServerSupabase()`) instead of proxying through `getServiceSupabase()`-backed API routes the way `/dashboard` does today, it would need explicit policies scoping `authenticated` access to `admin_users` members. Draft below. **Not needed for Phase 1 as scoped** — the route map already plans `/operator/records` as wrapping the existing service-role-backed `/api/admin/*` endpoints, same pattern as `/dashboard`. Only relevant if that plan changes.

```sql
-- OPTIONAL — only if /operator ever reads these tables directly via the
-- authenticated anon-key client instead of proxying through service-role API
-- routes. Not required for Phase 1 as currently scoped in SNX_PHASE0_ROUTE_MAP.md.

CREATE POLICY "admin_users can read bookings" ON bookings
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()));

CREATE POLICY "admin_users can read event_dates" ON event_dates
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()));

CREATE POLICY "admin_users can read expenses" ON expenses
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()));

CREATE POLICY "admin_users can read ota_bookings" ON ota_bookings
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()));
```

Staff-vs-owner field redaction (revenue, `host_fee_final`, etc.) would still need to happen at the query/API layer, same as the host dashboard does today — RLS policies here are row-level, not column-level.

## 5. Risk of breaking current BCC flows

- **4a (schema file correction):** none. Doesn't touch the live database, doesn't touch running code. Pure documentation-of-reality fix.
- **4b (optional policies), if applied:** low, but not zero. Adding SELECT policies for `authenticated` doesn't change service-role behavior (still bypasses RLS) and doesn't grant anything to `anon`. The only new exposure is: any Supabase-authenticated user who is *not* in `admin_users` gains nothing (policy requires membership), but any user who *is* in `admin_users` — including `staff` role — would gain direct table read access outside the existing app-layer redaction logic, if they ever obtained a raw Supabase client. Today that's not possible (no anon/authenticated client is wired up), but it's worth knowing this policy alone doesn't distinguish `owner`/`admin` from `staff`.

## 6. Recommendation

**Apply 4a now — review 4b later, don't apply yet.**

4a is a documentation correction with no production behavior change and no downside; leaving it as-is keeps the landmine live in the repo. 4b is speculative against a route-map decision (service-role proxy vs. direct authenticated read) that hasn't been made and isn't needed for Phase 1 as scoped — applying it now would add unused policy surface for no current benefit, and it would need staff/owner row-level scoping worked out first if it's ever adopted.

## Also noticed, out of the 4-table scope, not investigated further

`get_advisors` shows `products` also has RLS enabled with zero policies, contradicting `supabase-schema.sql`'s comment that "products has RLS DISABLED in production." Same drift pattern as above. Flagging only — not analyzed, not in this pass's scope, no action taken.
