#!/usr/bin/env bash
# Aislamiento, carrera de la última unidad y semilla. Base local. No usa Supabase remoto.
set -euo pipefail

cd "$(dirname "$0")/.."

DB="licorerias_endurecimiento"

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

sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/endurecimiento.sql

sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/endurecimiento-carrera.sql

SUC=$(sudo -u postgres psql -d "$DB" -tA -v ON_ERROR_STOP=1 -c \
  "select id from public.sucursales where slug = 'carrera'")
PROD=$(sudo -u postgres psql -d "$DB" -tA -v ON_ERROR_STOP=1 -c \
  "select id from public.productos where nombre = 'Ultima unidad'")

if [[ -z "$SUC" || -z "$PROD" ]]; then
  echo "No quedó la sucursal o el producto de la carrera." >&2
  exit 1
fi

comprar() {
  sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -c \
    "select public.crear_pedido('${SUC}'::uuid, 'Cliente Carrera', '59170000001', 'recojo', null, null, '', null, 99, 99, null, jsonb_build_array(jsonb_build_object('producto_id', '${PROD}'::uuid, 'cantidad', 1, 'precio', 1)));"
}

comprar >/tmp/carrera-a.out 2>/tmp/carrera-a.err &
pid_a=$!
comprar >/tmp/carrera-b.out 2>/tmp/carrera-b.err &
pid_b=$!
set +e
wait "$pid_a"
code_a=$?
wait "$pid_b"
code_b=$?
set -e

if [[ "$code_a" -eq 0 && "$code_b" -eq 0 ]]; then
  echo "Las dos compras de la última unidad pasaron." >&2
  exit 1
fi
if [[ "$code_a" -ne 0 && "$code_b" -ne 0 ]]; then
  echo "Ninguna compra de la última unidad pasó." >&2
  cat /tmp/carrera-a.err /tmp/carrera-b.err >&2
  exit 1
fi

fallo=/tmp/carrera-a.err
if [[ "$code_a" -eq 0 ]]; then
  fallo=/tmp/carrera-b.err
fi
if ! grep -q "stock suficiente" "$fallo"; then
  echo "La compra rechazada no fue por falta de stock." >&2
  cat "$fallo" >&2
  exit 1
fi

sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -c \
  "do \$\$
   declare n int; stock int;
   begin
     select count(*) into n from public.pedidos where sucursal_id = '${SUC}'::uuid;
     if n <> 1 then
       raise exception 'quedaron % pedidos', n;
     end if;
     select ps.stock into stock
     from public.producto_sucursal as ps
     where ps.producto_id = '${PROD}'::uuid
       and ps.sucursal_id = '${SUC}'::uuid;
     if stock <> 0 then
       raise exception 'el stock quedó en %', stock;
     end if;
   end
   \$\$;"

sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -f supabase/seed.sql
sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -f supabase/seed.sql
sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/semilla.sql

echo "Endurecimiento OK: aislamiento, una sola última unidad y semilla con licencia vigente."
