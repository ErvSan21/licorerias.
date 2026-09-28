"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import "leaflet/dist/leaflet.css";

export function MapaPin({
  lat,
  lng,
  onMove,
}: {
  lat: number | null;
  lng: number | null;
  onMove: (lat: number, lng: number) => void;
}) {
  const nodo = useRef<HTMLDivElement>(null);
  const inicio = useRef({ lat, lng });
  const [fallo, setFallo] = useState(false);
  const mover = useEffectEvent(onMove);

  useEffect(() => {
    const elemento = nodo.current;
    if (!elemento) return;
    let mapa: { remove: () => void } | null = null;
    let cancelado = false;
    const { lat: lat0, lng: lng0 } = inicio.current;

    void import("leaflet")
      .then((L) => {
        if (cancelado) return;
        const centro: [number, number] = lat0 != null && lng0 != null ? [lat0, lng0] : [-16.5, -68.15];
        const map = L.map(elemento, { scrollWheelZoom: false }).setView(centro, lat0 != null ? 15 : 12);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
        }).addTo(map);
        const icono = L.divIcon({
          className: "pin-sucursal",
          html: '<span style="display:block;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:999px;background:#7f1d1d;border:2px solid #fff"></span>',
          iconSize: [18, 18],
        });
        const marca = L.marker(centro, { draggable: true, icon: icono }).addTo(map);
        marca.on("dragend", () => {
          const pos = marca.getLatLng();
          mover(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
        });
        mapa = map;
      })
      .catch(() => {
        if (!cancelado) setFallo(true);
      });

    return () => {
      cancelado = true;
      mapa?.remove();
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div ref={nodo} className="h-64 w-full overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700" />
      {fallo ? (
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          El mapa no cargó. Escribe la latitud y la longitud.
        </p>
      ) : (
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Arrastra el pin o escribe la latitud y la longitud.
        </p>
      )}
    </div>
  );
}
