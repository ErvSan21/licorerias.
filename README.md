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
