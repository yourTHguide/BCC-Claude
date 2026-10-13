# Staging database (Supabase "BCC - Claude Staging", ref `jyhtznpethgzypblppnt`)

Staging is a schema copy of production (`oomhftxgvikzxlvqdcmr`) plus SMC Phase 1b objects.
It holds no real guest data. Never run these files against production.

## Rebuild from scratch

On a new, empty Supabase project, apply in filename order:

1. `migrations/01_…` to `migrations/10_…` (one Supabase migration each, same names as recorded)
2. `seed_smc.sql` — SMC catalogue rows (draft product, content, 29 Oct 2026 event, capacity 40)

Files 01–08 are composed from `supabase-schema.sql` and `supabase/migrations/2026090*`, adapted for
an empty database (no `DROP … IF EXISTS`, no `COMMENT ON`, Phase 3G constraints created directly in
final form). Files 09–10 are `supabase/migrations/20261013000001_smc_registration.sql` split at its
"Functions" banner. See `docs/smc/PHASE0_STAGING.md` for the production parity check.

## Verify the repo matches what staging recorded

Run on staging (read-only):

```sql
select name, md5(regexp_replace(regexp_replace(array_to_string(statements, E'\n'),
  '--[^\n]*', '', 'g'), '\s+|;', '', 'g')) as h
from supabase_migrations.schema_migrations order by version;
```

and compare with the same normalisation applied locally (comments removed, all whitespace and `;`
removed, md5). Last verified 13 Oct 2026: all 10 migrations identical.

## Tooling note

The Supabase connector used for this project holds any statement containing `DROP` for a manual
confirmation that cannot be given from the agent session, so staging migrations avoid `DROP`
statements.
