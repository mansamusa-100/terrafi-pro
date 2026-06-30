param(
  [string]$PostgresPassword = $env:POSTGRES_PASSWORD
)

if (-not $PostgresPassword) {
  Write-Host @"

Field-Pro database setup
========================
This creates the 'fieldpro' user/database, then runs migrations and seed.

Usage:
  .\scripts\setup-local-db.ps1 -PostgresPassword "YOUR_POSTGRES_ADMIN_PASSWORD"

Or:
  `$env:POSTGRES_PASSWORD="YOUR_PASSWORD"; npm run db:init

Use the password you set when installing PostgreSQL (user: postgres).

"@
  exit 1
}

$ErrorActionPreference = 'Stop'
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'

if (-not (Test-Path $psql)) {
  $psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
  if (-not $psql) {
    throw 'psql not found. Install PostgreSQL or add psql to PATH.'
  }
}

$env:PGPASSWORD = $PostgresPassword
$backendRoot = Join-Path $PSScriptRoot '..'

function Invoke-PostgresSql($sql) {
  & $psql -U postgres -h localhost -v ON_ERROR_STOP=1 -c $sql
}

Write-Host 'Step 1/4: Creating role fieldpro (if missing)...'
Invoke-PostgresSql @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'fieldpro') THEN
    CREATE ROLE fieldpro LOGIN PASSWORD 'fieldpro';
  END IF;
END
`$`$;
"@

Write-Host 'Step 2/4: Creating database fieldpro (if missing)...'
$exists = & $psql -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname = 'fieldpro'"
if ($exists -ne '1') {
  Invoke-PostgresSql 'CREATE DATABASE fieldpro OWNER fieldpro;'
} else {
  Write-Host '  Database fieldpro already exists.'
}

Write-Host 'Step 3/4: Applying Prisma migrations...'
Push-Location $backendRoot
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw 'Prisma migrate failed' }

Write-Host 'Step 4/4: Seeding demo data...'
npm run db:seed
if ($LASTEXITCODE -ne 0) { throw 'Seed failed' }
Pop-Location

Write-Host @"

Done! Backend/.env should use:
  DATABASE_URL="postgresql://fieldpro:fieldpro@localhost:5432/fieldpro?schema=public"

Start the app:
  npm run dev

Login: owner@anms.platform / demo

"@
