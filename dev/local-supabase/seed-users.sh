#!/usr/bin/env bash
# Creates demo companies + users through the Auth admin API, then their profiles.
set -euo pipefail
cd "$(dirname "$0")"
. ./keys.env
API=${API:-http://localhost:54321}
PSQL=${PSQL:-"psql -h 127.0.0.1 -p 54322 -U postgres -v ON_ERROR_STOP=1 -qtA"}
PASSWORD=${DEMO_PASSWORD:-Password123!}

create_user() { # email -> uuid
  local out
  out=$(curl -s -X POST "$API/auth/v1/admin/users" \
    -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$PASSWORD\",\"email_confirm\":true}")
  local id
  id=$(echo "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).id||"")}catch{}})')
  if [ -z "$id" ]; then id=$($PSQL -c "select id from auth.users where email='$1'"); fi
  echo "$id"
}

HQ=$($PSQL -c "insert into snapshot.companies default values returning company_id" | head -1)
$PSQL -c "insert into snapshot.company_versions (company_id,name,address) values ('$HQ','Platform HQ','1 Collins St, Melbourne VIC 3000')"
ACME=$($PSQL -c "insert into snapshot.companies default values returning company_id" | head -1)
$PSQL -c "insert into snapshot.company_versions (company_id,name,address) values ('$ACME','Acme Heating & Cooling','12 Smith St, Fitzroy VIC 3065')"

U1=$(create_user admin@demo.local)
U2=$(create_user manager@acme.local)
U3=$(create_user installer@acme.local)

$PSQL <<SQL
insert into snapshot.profiles (user_id, company_id, name, email, phone, is_admin, is_global_admin) values
  ('$U1','$HQ',  'Grace Global',   'admin@demo.local',     '0400 000 001', true,  true),
  ('$U2','$ACME','Morgan Manager', 'manager@acme.local',   '0400 000 002', true,  false),
  ('$U3','$ACME','Ivy Installer',  'installer@acme.local', '0400 000 003', false, false)
on conflict (user_id) do nothing;
SQL
echo "Seeded. Logins (password: $PASSWORD): admin@demo.local (global admin), manager@acme.local (company admin), installer@acme.local (staff)"
