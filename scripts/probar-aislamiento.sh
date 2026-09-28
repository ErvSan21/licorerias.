#!/usr/bin/env bash
# Crea una base local, aplica la migración y demuestra que la tienda A
# no ve datos de la tienda B. No usa un proyecto Supabase remoto.
set -euo pipefail

cd "$(dirname "$0")/.."

DB="licorerias_aislamiento"

if ! command -v psql >/dev/null 2>&1; then
  echo "Falta psql. En Ubuntu: sudo apt-get install postgresql" >&2
  exit 1
fi

if ! sudo -u postgres psql -d postgres -c "select 1" >/dev/null 2>&1; then
  sudo service postgresql start
fi

sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 -c \
  "select pg_terminate_backend(pid) from pg_stat_activity where datname = '${DB}' and pid <> pg_backend_pid();" \
  >/dev/null
sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 -c "drop database if exists ${DB};"
sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 -c "create database ${DB};"
sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/preparar_auth.sql
sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -f supabase/migrations/20260928120000_fundacion_multitenant.sql
sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/aislamiento.sql

echo "Aislamiento OK: el usuario de la tienda A no ve la tienda B."
