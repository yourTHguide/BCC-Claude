# Off-site production database backup (before SMC launch)

Production Supabase (`oomhftxgvikzxlvqdcmr`, "BCC - Claude") is on the Free plan, which has no
automatic backups. Take this manual backup on your Mac before launch and keep it somewhere
private (encrypted disk, password manager attachment, or a private cloud folder). The files
contain customer personal data: never email them or put them in a shared folder.

`npx supabase db dump` needs Docker, so this uses Postgres's own `pg_dump` instead.

## 1. One-time setup

```
brew install libpq
```

You need the database password (Supabase → Project Settings → Database → Reset database
password if unknown; the website uses API keys, not this password). Never paste it into chat.

## 2. Run the backup (Terminal)

```
mkdir -p ~/Backups/bcc-supabase && cd ~/Backups/bcc-supabase
PGDUMP="$(brew --prefix libpq)/bin/pg_dump"; STAMP=$(date +%Y%m%d-%H%M)
read -s PGPASSWORD; export PGPASSWORD        # paste the password, press Enter (nothing shows)
"$PGDUMP" -h aws-1-ap-southeast-1.pooler.supabase.com -p 5432 -U postgres.oomhftxgvikzxlvqdcmr -d postgres -Fc -f full-$STAMP.dump
"$PGDUMP" -h aws-1-ap-southeast-1.pooler.supabase.com -p 5432 -U postgres.oomhftxgvikzxlvqdcmr -d postgres -n public -f public-$STAMP.sql
unset PGPASSWORD; ls -lh
```

Host and user are from Supabase → Connect → Session pooler (port 5432). Passing them as
separate options avoids URL-encoding problems with the password.

- `full-….dump`: complete database (all schemas), custom format, for restore.
- `public-….sql`: readable SQL of the app tables, for checking.

## 3. Check it

```
for t in bookings products event_dates admin_users; do printf "%s " $t; awk -v t="COPY public.$t " 'index($0,t)==1{f=1;next} /^\\\.$/{f=0} f' public-*.sql | wc -l; done
"$(brew --prefix libpq)/bin/pg_restore" -l full-*.dump | grep -c "TABLE DATA"
```

Row counts should match the dashboard; the second number should be 20 or more.

## Restore (only if ever needed)

Restore into a new or empty Supabase project, never on top of the live one without a plan:
```
"$(brew --prefix libpq)/bin/pg_restore" -d "$NEW_DB_URL" --no-owner --no-privileges -n public full-STAMP.dump
```
For the SMC change alone, `supabase/rollback/20261013000001_smc_registration_down.sql`
removes exactly what the SMC migration added, without a restore.

Storage files (product photos, proposal PDFs) are not in these dumps; they live in Supabase
Storage and are unaffected by the SMC change.
