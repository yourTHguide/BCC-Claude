# Off-site production database backup (before SMC launch)

Production Supabase (`oomhftxgvikzxlvqdcmr`, "BCC - Claude") is on the Free plan, which has no
automatic backups. Take this manual backup on your Mac before launch and keep it somewhere
private (encrypted disk, password manager attachment, or a private cloud folder). The files
contain customer personal data: never email them or put them in a shared folder.

## 1. Get the connection string (do not paste it into chat)

Supabase → project **BCC - Claude** → **Connect** (top bar) → **Connection string** →
**Session pooler** → copy the URI. Replace `[YOUR-PASSWORD]` with the database password.
If you don't know the password: **Project Settings → Database → Reset database password**
(this does not affect the website, which uses API keys, not this password).

## 2. Run the backup (Terminal)

```
mkdir -p ~/Backups/bcc-supabase && cd ~/Backups/bcc-supabase
read -s DB_URL        # paste the connection string, press Enter (nothing shows)
STAMP=$(date +%Y%m%d-%H%M)
npx supabase db dump --db-url "$DB_URL" -f schema-$STAMP.sql
npx supabase db dump --db-url "$DB_URL" --role-only -f roles-$STAMP.sql
npx supabase db dump --db-url "$DB_URL" --data-only --use-copy -f data-$STAMP.sql
unset DB_URL
ls -lh
```

Docker is not needed for `--db-url`. Expect three files; `data-…sql` should be well over 0 KB.

## 3. Check it

```
grep -c "COPY public.bookings" data-*.sql      # expect 1
grep -c "CREATE TABLE" schema-*.sql            # expect 20 or more
```

## Restore (only if ever needed)

Restore into a new or empty Supabase project, never on top of the live one without a plan:
```
psql "$NEW_DB_URL" -f roles-STAMP.sql
psql "$NEW_DB_URL" -f schema-STAMP.sql
psql "$NEW_DB_URL" -c "SET session_replication_role = replica" -f data-STAMP.sql
```
For the SMC change alone, `supabase/rollback/20261013000001_smc_registration_down.sql`
removes exactly what the SMC migration added, without a restore.

Storage files (product photos, proposal PDFs) are not in these dumps; they live in Supabase
Storage and are unaffected by the SMC change.
