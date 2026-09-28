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
- `NEXT_PUBLIC_APP_URL`, `WHATSAPP_CLAVE` y `WA_VERIFY_TOKEN` — las usa el seguimiento y WhatsApp. La lista para Vercel está en Despliegue.

Sin esas variables la pantalla de login explica qué falta y no llama a Auth.

## Base de datos

Aplica las migraciones de `supabase/migrations` en orden (`npx supabase db push --linked --yes` cuando el proyecto está enlazado). `supabase/seed.sql` no corre con ese comando: crea dos tiendas de demostración con licencia vigente y hay que lanzarlo aparte.

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

## Módulo 4: inventario por sucursal

El stock vive en cada sucursal, en http://localhost:5000/t/{slug}/inventario. Se agrupa por categoría y marca el stock bajo. Reponer y ajustar piden motivo. Transferir pide confirmación y, si el producto no está en el destino, hay que ofrecerlo ahí primero. El vendedor solo consulta. El CSV se descarga e importa con las columnas sucursal, categoria, producto, stock y stock_minimo. La sucursal del archivo es el slug.

```bash
npm run test:inventario
```

Cómo probarlo:

1. Entra como dueño en http://localhost:5000/t/{slug}/inventario. Elige una sucursal en la barra.
2. Reponer una cantidad con motivo. El stock sube y «Ver movimientos» muestra la reposición.
3. Ajusta el stock contado. Si pides más salida de la que hay, responde que no hay stock suficiente.
4. Transfiere a otra sucursal donde el producto ya se ofrece. Confirma el diálogo. Si no se ofrece, el mensaje pide definir la disponibilidad.
5. Como vendedor, la misma pantalla no muestra botones de cambio.
6. `GET /api/t/{slug}/inventario` sin sesión responde 401.

## Módulo 5: ofertas y colecciones

Las ofertas están en http://localhost:5000/t/{slug}/ofertas y las colecciones en http://localhost:5000/t/{slug}/colecciones. El porcentaje puede ser de toda la tienda y se calcula sobre el precio base de cada sucursal. El precio fijo exige sucursal. `precio_vigente` devuelve el menor precio final vigente, con el origen central, propio u oferta. El gerente solo guarda ofertas de sus sucursales. Las colecciones las arma el dueño.

```bash
npm run test:ofertas
```

Cómo probarlo:

1. Entra como dueño en http://localhost:5000/t/{slug}/ofertas. Crea un porcentaje para todas las sucursales, con inicio y fin.
2. Crea un precio fijo más bajo en una sucursal. `GET /api/t/{slug}/precio?producto={id}&sucursal={id}` devuelve ese precio y origen oferta.
3. Una oferta con fecha futura queda como Programada y no cambia el precio.
4. Como gerente, el formulario no ofrece «Todas las sucursales». Como vendedor, la lista no tiene botones de cambio.
5. En http://localhost:5000/t/{slug}/colecciones crea una colección con productos e imagen. El gerente ve la lista sin poder guardarla.
6. `GET /api/t/{slug}/ofertas` sin sesión responde 401.

## Módulo 6: envío y mapa

Las tarifas y las zonas están en http://localhost:5000/t/{slug}/envio. Cada sucursal tiene sus rangos (por ejemplo 1 km Bs 7) y zonas circulares de tarifa fija o bloqueadas. `POST /api/envio` con sucursalId, lat y lng no acepta un costo ni una distancia del navegador: si el punto cae en una zona bloqueada responde fuera de zona; si cae en una tarifa fija, cobra esa; si no, pide la distancia a OSRM y, si tarda más de 5 segundos o falla, usa Haversine. El mapa se carga solo en el cliente.

```bash
npm run test:envio
```

Cómo probarlo:

1. Entra como dueño en http://localhost:5000/t/{slug}/envio. Elige una sucursal que ya tenga pin en Sucursales.
2. Agrega rangos de 1, 2 y 4 km. Intentar repetir el de 1 km responde que ese rango ya existe.
3. Dibuja una zona bloqueada y otra con tarifa fija. El círculo sigue al pin.
4. En «Probar un punto», mueve el pin y pulsa Calcular envío. Verás el costo o «Fuera de zona».
5. «Usar mi ubicación» pide permiso. Si lo niegas, el mapa explica que puedes mover el pin.
6. `POST /api/envio` sin un JSON válido responde 400. `GET /api/t/{slug}/envio/tarifas` sin sesión responde 401.

## Módulo 7: pedidos y estados

Los pedidos del panel están en http://localhost:5000/t/{slug}/pedidos. El cliente los crea con `POST /api/pedidos`. El servidor ignora precios, envío y tienda del navegador: el recojo queda con envío 0 y sin coordenadas; el delivery se recalcula con las tarifas de la sucursal. El stock baja en esa sucursal y, si se cancela, vuelve a la misma. Un pedido nuevo se resalta dos segundos. Si el aviso de WhatsApp falla, el pedido igual cambia de estado.

```bash
npm run test:pedidos
```

Cómo probarlo:

1. Entra como dueño, gerente o vendedor en http://localhost:5000/t/{slug}/pedidos.
2. Filtra por estado, entrega, sucursal o fecha. Un recojo programado muestra la hora y, con el filtro Recojo, queda ordenado por la más próxima.
3. En un pedido nuevo pulsa Aceptar pedido. Luego Marcar como listo. En delivery sigue Marcar como enviado. Cancelar pide confirmación y devuelve el stock.
4. Abre Ver historial para ver los estados. Delivery incluye dirección y Ver ubicación.
5. `POST /api/pedidos` con ítems, sucursal, tipo y teléfono crea el pedido (201). Un precio enviado en el JSON no se cobra. Sin sesión, `POST /api/admin/pedidos/{id}/estado` responde 401.

## Módulo 8: tienda pública

La tienda está en http://localhost:5000/t/{slug}. Si hay una sola sucursal, entra directo. Si hay varias, eliges o usas tu ubicación. El catálogo de una sucursal está en http://localhost:5000/t/{slug}/s/{sucursal}. El panel del personal pasó a http://localhost:5000/t/{slug}/panel. Al entrar, la tienda pregunta si eres mayor de 18. Una licencia que no está vigente muestra «Tienda no disponible».

```bash
npm run test:vitrina
```

Cómo probarlo:

1. Abre http://localhost:5000/t/{slug} sin entrar. Confirma la edad y elige sucursal. Los productos muestran el precio de esa sucursal. Una oferta tacha el precio anterior y dice OFERTA. Agotado no deja agregar y no muestra cuántas unidades quedan.
2. Busca un producto: mientras escribes, la lista anterior se atenúa. Filtra por categoría.
3. Agrega al carrito. El contador da un pequeño salto. Cambia de sucursal: si un precio cambió o el producto ya no está, lo avisa.
4. Con la sucursal cerrada puedes mirar, pero no confirmar. Con recojo, el envío es 0. Con delivery, mueve el pin: verás «Calculando envío...» y luego el total, o «Fuera de zona de entrega».
5. `?tel=5917XXXXXXX` rellena el celular. Confirmar pedido dice «Enviando pedido…», muestra el check y abre el seguimiento.
6. Entra como personal: Inicio abre http://localhost:5000/t/{slug}/panel.

## Módulo 9: seguimiento del pedido

Después de confirmar, la tienda abre http://localhost:5000/t/{slug}/pedido/{id}. Ahí se ve la línea Recibido → Aceptado → Listo y, si es delivery, En camino. El recojo termina en Listo y muestra la hora. La página se actualiza cada 15 segundos. `GET /api/t/{slug}/pedido/{id}` devuelve solo ese pedido. No hay lectura pública de la tabla `pedidos`. Si la licencia no está vigente, la página dice «Tienda no disponible».

```bash
npm run test:seguimiento
```

Cómo probarlo:

1. Confirma un pedido en http://localhost:5000/t/{slug}/s/{sucursal}. Tras el check, abre el seguimiento.
2. En otra ventana, acepta el pedido en http://localhost:5000/t/{slug}/pedidos. En menos de 15 segundos la línea avanza y el paso actual se mueve.
3. Un recojo no muestra «En camino». Uno cancelado dice «Pedido cancelado».
4. Abre el mismo enlace con la licencia suspendida: «Tienda no disponible». Un id de otra tienda o inventado responde 404.
5. `GET /api/t/{slug}/pedido/{id}` no incluye teléfono, coordenadas ni `tienda_id`.

## Módulo 10: WhatsApp

El dueño registra el número en http://localhost:5000/t/{slug}/whatsapp. Si una sucursal tiene el suyo, sus pedidos salen por ese número. Si no, salen por el de la tienda. El token se guarda cifrado y la pantalla solo muestra los últimos 4 caracteres. `GET` y `POST /api/whatsapp` atienden el webhook de Meta. Un número desconocido se ignora y la respuesta sigue siendo 200. El saludo se envía si no hay conversación o si el último saludo tiene más de 12 horas, con el enlace `/t/{slug}?tel=` o el de la sucursal. Crear un pedido y cambiar su estado avisan al cliente. Si WhatsApp no responde, el pedido no se deshace.

```bash
npm run test:whatsapp
```

Cómo probarlo:

1. En `.env.local` define `WHATSAPP_CLAVE` (32 bytes en base64) y `WA_VERIFY_TOKEN`. Reinicia el servidor del puerto 5000.
2. Entra como dueño en http://localhost:5000/t/{slug}/whatsapp. Guarda el identificador del número, el de la cuenta y el token. El token no vuelve a verse completo.
3. Pulsa Enviar mensaje de prueba con un celular. El botón dice «Enviando mensaje de prueba…».
4. Crea un pedido. El cliente debería recibir «Pedido #XXXX recibido». Si el aviso falla, al cambiar el estado el panel dice «No se pudo avisar por WhatsApp» y ofrece abrir el chat.
5. `GET /api/whatsapp?hub.mode=subscribe&hub.verify_token=TU_TOKEN&hub.challenge=hola` responde `hola`. Un token distinto responde 403. `POST /api/whatsapp` con un evento de estado responde 200.
6. Como gerente o vendedor, esa pantalla no existe.

## Módulo 11: marca de la tienda

El dueño edita la marca en http://localhost:5000/t/{slug}/marca. El nombre comercial, el logo, el color, el banner y el mensaje de bienvenida son de toda la tienda. El horario y la ubicación siguen en cada sucursal. La vista previa cambia al escribir. Al guardar, la tienda pública usa esos datos. El color tiene que contrastar con el texto del botón. Las imágenes van en Storage, en `{tienda_id}/marca/`. Si hay un mensaje de bienvenida, WhatsApp lo usa y le agrega el enlace de la tienda.

```bash
npm run test:marca
```

Cómo probarlo:

1. Entra como dueño en http://localhost:5000/t/{slug}/marca. Escribe un nombre, un color oscuro y un mensaje. La vista previa cambia antes de guardar.
2. Prueba un gris medio, por ejemplo `#888888`. El formulario dice que no contrasta y no lo guarda.
3. Pulsa Guardar marca. El botón dice «Guardando…». Abre http://localhost:5000/t/{slug}: ves el nombre, el mensaje y los botones con ese color.
4. Sube un logo y un banner JPG, PNG o WebP de menos de 1,5 MB. Vuelven a aparecer en la tienda.
5. Como gerente o vendedor, esa pantalla no existe. Con la licencia suspendida, la tienda pública sigue diciendo «Tienda no disponible».

## Módulo 12: reportes

Los reportes están en http://localhost:5000/t/{slug}/reportes. El dueño ve toda la tienda y puede comparar sucursales. El gerente solo ve las suyas. El vendedor no entra. El filtro es un rango de fechas y una sucursal, y queda en la dirección. Las tarjetas muestran ventas, pedidos y ticket promedio. Los gráficos (sucursal, categoría, producto, entrega, día, hora, origen del precio, personal e inventario) se cargan después. Si el rango no tiene pedidos, verás un estado vacío. Exportar CSV descarga el mismo corte.

```bash
npm run test:reportes
```

Cómo probarlo:

1. Entra como dueño en http://localhost:5000/t/{slug}/reportes. Elige la última semana y pulsa Ver.
2. Cambia la sucursal. Las tarjetas y la comparación cambian. Un gerente no ve sucursales que no tiene asignadas.
3. Entra como vendedor: el menú no tiene Reportes y la dirección responde que no existe.
4. Pulsa Exportar CSV. El botón dice «Exportando…» y baja un archivo con ventas, cancelaciones e inventario.
5. Un rango de más de un año no se consulta.

## Módulo 13: endurecimiento y despliegue

Un usuario de la tienda A no lee la tienda B (`npm run test:aislamiento`). El gerente de la sucursal 1 no ve ni edita la sucursal 2. El vendedor no ejecuta las funciones de precio. `POST /api/pedidos` ignora precio, envío, distancia y `tiendaId` del navegador: el recojo cobra el precio del catálogo y envío 0. Dos compras a la vez de la última unidad dejan un solo pedido. Las rutas públicas (`/api/pedidos`, `/api/envio`, el seguimiento, el precio y la verificación de WhatsApp) responden 429 al pasar de 30 por minuto por IP. El `POST` del webhook sigue en 200 para que Meta no reintente. Un JSON que no es un objeto responde «La solicitud no es válida.»

Los cambios masivos de precio (`precio.ajuste_central`, `precio.ajuste_propio`, `precio.volver_todos`, `precio.copiar`), la suspensión (`licencia.suspender`) y el alta de personal (`personal.invitar`) ya escriben en `auditoria`. Un fallo de esa escritura no deshace la acción.

`supabase/seed.sql` crea `demo-centro` (1 sucursal, precio central) y `demo-cadena` (3 sucursales; Norte con precio propio de Bs 18 y el resto con el central de Bs 22). Las dos tienen licencia activa. No toca otras tiendas. Si `/t/esquina` dice «Tienda no disponible», la licencia de esa tienda no está vigente: la semilla no la abre.

```bash
npm run test:endurecimiento
```

Cómo probarlo:

1. `npm run dev` (puerto 5000).
2. En Postgres local, el comando de arriba termina con `Endurecimiento OK`.
3. Para ver las tiendas de demostración en el proyecto enlazado, aplica `supabase/seed.sql` en el SQL editor. No usa `db push`. Abre http://localhost:5000/t/demo-centro y http://localhost:5000/t/demo-cadena.
4. `POST /api/pedidos` con un `precio` o un `tiendaId` en el JSON no cambia el cobro. Un cuerpo `[]` responde 400 con «La solicitud no es válida.»
5. Repetir `POST /api/envio` más de 30 veces en un minuto responde 429. El envío de la otra ruta sigue disponible.

## Despliegue

No se ejecutó vercel-optimize: la aplicación no está desplegada y no tiene tráfico en Vercel.

### Variables en Vercel

Copia los nombres de `.env.local.example`. Los valores salen del panel de Supabase y de Meta. No los pongas en el repositorio.

- `NEXT_PUBLIC_SUPABASE_URL`: Project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`: clave publicable. Una de las dos.
- `SUPABASE_SERVICE_ROLE_KEY`: clave secret del servidor. No uses el prefijo `NEXT_PUBLIC_`.
- `NEXT_PUBLIC_APP_URL`: origen público, por ejemplo `https://tu-dominio.vercel.app`. Lo usan el seguimiento y el saludo de WhatsApp.
- `WHATSAPP_CLAVE`: 32 bytes en base64. Solo servidor. Cifra el token de Meta.
- `WA_VERIFY_TOKEN`: el mismo texto que configuras en el webhook de Meta. Solo servidor.

### Supabase

1. Crea el proyecto y enlázalo con la CLI. `npx supabase db push --linked --yes` aplica `supabase/migrations`. Ahí están Row Level Security (RLS), las funciones `security definer` y los buckets.
2. No desactives RLS. `anon` no lee las tablas de negocio. El navegador usa la clave publicable. El servidor usa `service_role` y vuelve a comprobar tienda, sucursal y rol.
3. Storage: el bucket `productos` permite lectura pública y escritura al personal, en `{tienda_id}/productos/`. El bucket `marca` permite lectura pública. La escritura de logo y banner la hace el servidor, en `{tienda_id}/marca/`.
4. Realtime: la migración agrega `public.pedidos` a la publicación `supabase_realtime` si esa publicación existe. En el dashboard, confirma que la tabla `pedidos` tiene Realtime activo. El panel escucha los pedidos de la tienda con la sesión del personal.
5. Auth: activa el acceso por correo. Crea el usuario del super admin e inserta su `user_id` en `super_admins`. El dueño entra por la invitación del panel `/super`.
6. La semilla es opcional y no corre con `db push`.

### Meta

1. En el panel de la tienda, http://localhost:5000/t/{slug}/whatsapp, guarda el identificador del número y el de la cuenta de WhatsApp Business. El token queda cifrado.
2. En Meta, el webhook apunta a `https://TU_DOMINIO/api/whatsapp`. El token de verificación es `WA_VERIFY_TOKEN`.
3. Suscribe el campo `messages`. Un evento de estado o un número desconocido responden 200 y no crean el pedido.

### Vercel con Git

1. Sube el repositorio a GitHub. No subas `.env.local`, `supabase/.gitignore` ni `supabase/config.toml` si tienen datos locales.
2. En Vercel, importa ese repositorio. El framework es Next.js. El comando de desarrollo del proyecto usa el puerto 5000. En Vercel el start lo define la plataforma.
3. Carga las variables de la lista de arriba en Production y Preview.
4. Elige la rama de producción. Cada push a esa rama despliega. No hace falta el CLI de Vercel para publicar.
5. Después del primer despliegue, pon en `NEXT_PUBLIC_APP_URL` la URL que te dio Vercel y vuelve a desplegar para que los enlaces de WhatsApp usen ese origen.

### Respaldo

1. En el plan de Supabase que incluye copias, activa el respaldo diario desde el dashboard (Database, Backups).
2. Para una copia propia: `pg_dump` de la base, fuera del repositorio. El archivo tiene datos de clientes. No lo subas a Git.
3. Para probar una restauración, levanta un proyecto vacío, restaura el volcado y aplica las migraciones que falten. Entra a `/super` y abre un pedido de prueba. No restaures encima de producción sin esa prueba.
4. Anota quién guarda la clave de la copia y cada cuánto se renueva. La clave `service_role` y `WHATSAPP_CLAVE` se rotan en Vercel, no dentro del volcado.
