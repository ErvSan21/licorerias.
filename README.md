# Licorerías

Fundación multi-tenant (Módulo 0): tiendas, miembros, super admins, auditoría, login y el layout base del panel.

El servidor de desarrollo usa el puerto **5000**.

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Abre http://localhost:5000

## Variables

En `.env.local` (no se sube a git):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (o `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` — solo servidor. El `service_role` se salta RLS.

Aún no hay un proyecto Supabase enlazado. Sin esas variables la pantalla de login explica qué falta y no llama a Auth.

## Base de datos

Aplica `supabase/migrations/20260928120000_fundacion_multitenant.sql` en el SQL editor de Supabase (o con `supabase db push` cuando el proyecto exista).

La migración espera `auth.users` y `auth.uid()`, que Supabase ya trae. El archivo `supabase/tests/preparar_auth.sql` es solo un stub para Postgres local: no lo apliques en Supabase.

El aislamiento está en RLS. `es_super_admin()` y `tiene_rol_tienda(tienda_id, roles)` son `security definer`, con `search_path = public`, y no las puede ejecutar `public`, `anon` ni `authenticated`. Las rutas de servidor verifican el token con `requireStaff` o `requireSuperAdmin` y resuelven la tienda por el slug de `/t/[slug]`. No aceptan un `tienda_id` del navegador.

El acceso por sucursal (`sucursalId`) queda en la firma de `requireStaff` y se rechaza hasta el Módulo 2, que es el que crea sucursales.

## Cómo probarlo

1. `npm run dev` y abre http://localhost:5000/login (puerto 5000, no 3000).
2. Sin `.env.local` verás el aviso de configuración.
3. Con Supabase: crea dos usuarios en Auth, dos filas en `tiendas` y una fila en `miembros` por usuario. Entra con cada uno. Cada cual solo abre `/t/{su-slug}`.
4. `GET /api/t/{slug}/sesion` devuelve el rol si la membresía es válida. `GET /api/super/sesion` exige una fila en `super_admins`.
5. Aislamiento en Postgres local (no hace falta el proyecto remoto):

```bash
npm run test:aislamiento
```

El script crea la base `licorerias_aislamiento`, aplica la migración y corre `supabase/tests/aislamiento.sql`. Tiene que terminar con `Aislamiento OK`. Si falla, el comando sale con error.
