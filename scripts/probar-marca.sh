#!/usr/bin/env bash
# Aplica las migraciones en Postgres local y prueba la marca de la tienda.
# No usa el proyecto Supabase remoto ni imprime secretos.
set -euo pipefail

cd "$(dirname "$0")/.."

DB="licorerias_marca"

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
for migracion in supabase/migrations/*.sql; do
  sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -f "$migracion"
done
sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/marca.sql

echo "Marca OK: nombre, color y bienvenida por tienda, sin escritura pública."
