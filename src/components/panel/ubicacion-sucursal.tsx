"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { guardarUbicacionAccion } from "@/app/t/[slug]/actions";
import { MapaCliente } from "@/components/panel/mapa-cliente";
import { Campo, claseCampo } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";

type Sucursal = { id: string; nombre: string; lat: number | null; lng: number | null };
type Punto = { lat: number; lng: number };

/** Ubicación de la sucursal: link de Google Maps o pin en el mapa. De ahí sale la distancia del envío. */
export function UbicacionSucursal({
  slug,
  sucursales,
  sucursalId,
  lectura,
}: {
  slug: string;
  sucursales: Sucursal[];
  sucursalId: string;
  lectura: boolean;
}) {
  const router = useRouter();
  const publicar = useToast();
  const [elegida, setElegida] = useState(sucursalId);
  const sucursal = sucursales.find((item) => item.id === elegida) ?? sucursales[0];
  const guardado: Punto | null =
    sucursal && sucursal.lat != null && sucursal.lng != null ? { lat: sucursal.lat, lng: sucursal.lng } : null;
  const [pendiente, setPendiente] = useState<Punto | null>(null);
  const [enlace, setEnlace] = useState("");
  const [cargando, setCargando] = useState<"enlace" | "pin" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const punto = pendiente ?? guardado;

  function guardar(entrada: { punto: Punto } | { enlace: string }, origen: "enlace" | "pin") {
    if (!sucursal) return;
    setCargando(origen);
    setError(null);
    void guardarUbicacionAccion(slug, sucursal.id, entrada).then((resultado) => {
      setCargando(null);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setPendiente(null);
      setEnlace("");
      publicar("exito", resultado.aviso);
      router.refresh();
    });
  }

  if (!sucursal) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {guardado ? <Tag tono="ok">Ubicación guardada</Tag> : <Tag tono="danger">Falta la ubicación</Tag>}
        {guardado ? null : (
          <span className="text-sm text-[var(--mu)]">Sin ella no se puede calcular el costo del envío.</span>
        )}
      </div>

      {sucursales.length > 1 ? (
        <Campo id="ubicacion-sucursal" etiqueta="Sucursal">
          <select
            id="ubicacion-sucursal"
            value={elegida}
            onChange={(event) => {
              setElegida(event.target.value);
              setPendiente(null);
              setError(null);
            }}
            className={claseCampo}
          >
            {sucursales.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </select>
        </Campo>
      ) : null}

      {lectura ? null : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!enlace.trim()) return;
            guardar({ enlace }, "enlace");
          }}
        >
          <Campo id="ubicacion-enlace" etiqueta="Link de Google Maps" ayuda="En Google Maps: Compartir → Copiar vínculo, y pégalo aquí.">
            <div className="flex gap-2">
              <input
                id="ubicacion-enlace"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://maps.app.goo.gl/…"
                value={enlace}
                onChange={(event) => setEnlace(event.target.value)}
                className={claseCampo}
              />
              <Button type="submit" variant="secundario" loading={cargando === "enlace"} loadingLabel="Buscando…" disabled={!enlace.trim()}>
                Usar
              </Button>
            </div>
          </Campo>
        </form>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{lectura ? "Ubicación" : "O pon el pin en el mapa"}</span>
        <MapaCliente
          key={sucursal.id}
          lat={punto?.lat ?? null}
          lng={punto?.lng ?? null}
          onMove={(lat, lng) => {
            if (lectura) return;
            setPendiente({ lat, lng });
          }}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[var(--er)]">
          {error}
        </p>
      ) : null}
      {pendiente && !lectura ? (
        <div className="flex gap-2">
          <Button type="button" className="flex-1" loading={cargando === "pin"} loadingLabel="Guardando…" onClick={() => guardar({ punto: pendiente }, "pin")}>
            Guardar ubicación
          </Button>
          <Button type="button" variant="secundario" className="flex-1" disabled={cargando != null} onClick={() => setPendiente(null)}>
            Cancelar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
