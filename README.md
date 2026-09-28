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

`requireStaff` comprueba la sucursal cuando la ruta la pide. El dueño entra a todas; gerente y vendedor solo a las asignadas.

## Cómo probarlo

1. `npm run dev` y abre http://localhost:5000/login (puerto 5000, no 3000).
2. Sin `.env.local` verás el aviso de configuración.
3. Con Supabase: crea dos usuarios en Auth, dos filas en `tiendas` y una fila en `miembros` por usuario. Entra con cada uno. Cada cual solo abre `/t/{su-slug}`.
4. `GET /api/t/{slug}/sesion` devuelve el rol si la membresía es válida. `GET /api/super/sesion` exige una fila en `super_admins`.
5. Aislamiento en Postgres local (no hace falta el proyecto remoto):

```bash
npm run test:aislamiento
```

El script crea la base `licorerias_aislamiento`, aplica las migraciones y corre `supabase/tests/aislamiento.sql`. Tiene que terminar con `Aislamiento OK`. Si falla, el comando sale con error.

## Módulo 1: licencias y panel del super admin

Planes de ejemplo: Básico (1 sucursal, Bs 149), Pro (3 sucursales, Bs 349) y Cadena (ilimitado, Bs 699). Una licencia está vigente si la tienda está activa, el estado es prueba o activa, y la fecha de hoy en Bolivia no pasó del vencimiento más los días de gracia.

El panel está en http://localhost:5000/super. Hay que entrar con un usuario que tenga fila en `super_admins`. Desde ahí se crea la tienda, la licencia de prueba y la invitación del dueño. También se cambia el plan, se extiende, se suspende (con confirmación) y se registra un pago en Bs.

Si la licencia no está vigente, quien entra sin sesión a `/t/{slug}` ve “Tienda no disponible”. El personal entra igual, pero el panel queda en solo lectura.

```bash
npm run test:licencias
npm run lint
npm run typecheck
```

Cómo probarlo:

1. `npm run dev` (puerto 5000). Entra en http://localhost:5000/login con el super admin y abre http://localhost:5000/super.
2. Crea una tienda. El listado muestra el plan y el vencimiento. “Por vencer” lista las que vencen en 7 días.
3. En la tienda, registra un pago, extiende la fecha y suspende. Al suspender, `/t/{slug}` sin sesión dice “Tienda no disponible” y el panel del personal avisa que está en solo lectura.
4. `GET /api/super/tiendas` y `GET /api/super/sesion` responden 401 sin sesión.

## Módulo 2: sucursales y personal

El dueño crea sucursales en http://localhost:5000/t/{slug}/sucursales, con mapa, horario y el interruptor Abierta. El personal se invita en `/t/{slug}/personal`. Gerente y vendedor solo ven sus sucursales. “Todas las sucursales” aparece solo para el dueño. El cupo del plan bloquea sucursales y usuarios de más.

```bash
npm run test:sucursales
```

Cómo probarlo:

1. Entra como dueño en http://localhost:5000/t/{slug}/sucursales y crea una sucursal. Arrastra el pin o escribe latitud y longitud.
2. Cambia Abierta. Si la licencia no está vigente, el cambio se revierte y el panel sigue en solo lectura.
3. Invita a un gerente con una sucursal. Con el plan Básico, la segunda sucursal activa responde que se alcanzó el máximo.
4. `GET /api/t/{slug}/sucursales` sin sesión responde 401.

## Módulo 3: catálogo y precios

El dueño carga productos en http://localhost:5000/t/{slug}/productos, con imagen (se comprime a 800 px) y el precio central. En http://localhost:5000/t/{slug}/productos/precios cada sucursal muestra si usa el precio central o el propio. El gerente, en su sucursal, puede pasar a precio propio si la tienda lo permite. El margen máximo y el bloqueo viven en la configuración de esa pantalla. Las acciones masivas piden confirmación y quedan en auditoría y en el historial.

El cupo de productos del plan se aplica al crear o reactivar. La imagen se guarda en `{tienda_id}/productos/...`: el personal de la tienda escribe y cualquiera puede leer.

```bash
npm run test:catalogo
```

Cómo probarlo:

1. Entra como dueño en http://localhost:5000/t/{slug}/productos y crea un producto con imagen y sucursales.
2. Abre Precios. Cambia el central y el propio de una sucursal. El historial del producto muestra ambos.
3. Como gerente, en tu sucursal, pasa un producto a precio propio. Si el dueño apaga “Las sucursales pueden fijar su precio”, vuelve al central.
4. Con el plan Básico, al pasar de 200 productos activos el alta responde que se alcanzó el máximo.
5. `GET /api/t/{slug}/productos` sin sesión responde 401.
