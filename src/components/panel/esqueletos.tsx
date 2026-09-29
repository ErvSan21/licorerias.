import { EstadoCarga, Skeleton } from "@/components/ui/skeleton";

/** Esqueletos del panel: copian la forma real de cada pantalla para que la carga no salte. */

function Encabezado({ volver = false, accion = false }: { volver?: boolean; accion?: boolean }) {
  return (
    <>
      {volver ? (
        <span className="flex items-center gap-2">
          <Skeleton className="ui-circulo h-9 w-9" />
          <Skeleton className="h-4 w-28" />
        </span>
      ) : null}
      <span className="flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-40" />
        {accion ? <Skeleton className="ui-circulo h-10 w-10" /> : null}
      </span>
    </>
  );
}

function Chips({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <span className="flex gap-2 overflow-hidden">
      {Array.from({ length: cantidad }, (_, indice) => (
        <Skeleton key={indice} className="h-9 w-24 shrink-0 rounded-full" />
      ))}
    </span>
  );
}

/** Fila de lista: miniatura o avatar, dos líneas y un control a la derecha. */
function Fila({ redonda = false }: { redonda?: boolean }) {
  return (
    <span className="ui-tarjeta flex items-center gap-3 p-4">
      <Skeleton className={redonda ? "ui-circulo h-11 w-11 shrink-0" : "h-14 w-14 shrink-0 rounded-xl"} />
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </span>
      <Skeleton className="ui-circulo h-8 w-8 shrink-0" />
    </span>
  );
}

export function EsqueletoLista({
  etiqueta,
  filas = 4,
  volver = false,
  accion = false,
  chips = false,
  redonda = false,
}: {
  etiqueta: string;
  filas?: number;
  volver?: boolean;
  accion?: boolean;
  chips?: boolean;
  redonda?: boolean;
}) {
  return (
    <EstadoCarga etiqueta={etiqueta} className="flex flex-col gap-4">
      <Encabezado volver={volver} accion={accion} />
      {chips ? <Chips /> : null}
      <span className="flex flex-col gap-3">
        {Array.from({ length: filas }, (_, indice) => (
          <Fila key={indice} redonda={redonda} />
        ))}
      </span>
    </EstadoCarga>
  );
}

export function EsqueletoPedidos() {
  return (
    <EstadoCarga etiqueta="Cargando pedidos…" className="flex flex-col gap-4">
      <Encabezado />
      <Chips cantidad={5} />
      <span className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, indice) => (
          <span key={indice} className="ui-tarjeta flex flex-col gap-3 p-4">
            <span className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </span>
            <span className="flex items-center justify-between gap-3">
              <span className="flex gap-1.5">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-12 rounded-full" />
              </span>
              <Skeleton className="h-5 w-20" />
            </span>
            <Skeleton className="h-3 w-44" />
          </span>
        ))}
      </span>
    </EstadoCarga>
  );
}

export function EsqueletoVentas() {
  return (
    <EstadoCarga etiqueta="Cargando productos…" className="flex flex-col gap-4">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Chips cantidad={5} />
      <span className="flex flex-col gap-3">
        {Array.from({ length: 6 }, (_, indice) => (
          <span key={indice} className="ui-tarjeta flex items-center justify-between gap-3 p-4">
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/4" />
            </span>
            <Skeleton className="h-10 w-28 rounded-xl" />
          </span>
        ))}
      </span>
    </EstadoCarga>
  );
}

/** Formulario o detalle: volver, título y bloques de campos. */
export function EsqueletoFormulario({ etiqueta, bloques = 2 }: { etiqueta: string; bloques?: number }) {
  return (
    <EstadoCarga etiqueta={etiqueta} className="flex flex-col gap-4">
      <Encabezado volver />
      {Array.from({ length: bloques }, (_, bloque) => (
        <span key={bloque} className="ui-tarjeta flex flex-col gap-3 p-4">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </span>
      ))}
    </EstadoCarga>
  );
}
