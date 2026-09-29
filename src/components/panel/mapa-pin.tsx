"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Punto = { lat: number; lng: number };

export function MapaPin({
  lat,
  lng,
  onMove,
  radioKm = null,
  miUbicacion = true,
}: {
  lat: number | null;
  lng: number | null;
  onMove: (lat: number, lng: number) => void;
  radioKm?: number | null;
  /** En el mostrador la ubicación del vendedor no es la del cliente. */
  miUbicacion?: boolean;
}) {
  const nodo = useRef<HTMLDivElement>(null);
  const inicio = useRef({ lat, lng, radioKm });
  const mapaRef = useRef<{ remove: () => void } | null>(null);
  const marcaRef = useRef<{ setLatLng: (punto: [number, number]) => void; getLatLng: () => Punto } | null>(null);
  const circuloRef = useRef<{ setLatLng: (punto: [number, number]) => void; setRadius: (metros: number) => void; remove: () => void } | null>(null);
  const [fallo, setFallo] = useState(false);
  const [listo, setListo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const mover = useEffectEvent(onMove);

  useEffect(() => {
    const elemento = nodo.current;
    if (!elemento) return;
    let cancelado = false;
    const { lat: lat0, lng: lng0, radioKm: radio0 } = inicio.current;

    void import("leaflet").then(async (L) => {
      await import("leaflet/dist/leaflet.css");
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
      const colocar = (punto: { lat: number; lng: number }) => {
        const siguiente = { lat: Number(punto.lat.toFixed(6)), lng: Number(punto.lng.toFixed(6)) };
        marca.setLatLng([siguiente.lat, siguiente.lng]);
        circuloRef.current?.setLatLng([siguiente.lat, siguiente.lng]);
        mover(siguiente.lat, siguiente.lng);
      };
      marca.on("dragend", () => colocar(marca.getLatLng()));
      map.on("click", (evento) => colocar(evento.latlng));
      if (radio0 != null && radio0 > 0) {
        circuloRef.current = L.circle(centro, {
          radius: radio0 * 1000,
          color: "#7f1d1d",
          weight: 2,
          fillOpacity: 0.12,
        }).addTo(map);
      }
      marcaRef.current = marca;
      mapaRef.current = map;
      setListo(true);
    }).catch(() => {
      if (!cancelado) setFallo(true);
    });

    return () => {
      cancelado = true;
      mapaRef.current?.remove();
      mapaRef.current = null;
      marcaRef.current = null;
      circuloRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!listo || lat == null || lng == null) return;
    marcaRef.current?.setLatLng([lat, lng]);
    circuloRef.current?.setLatLng([lat, lng]);
  }, [lat, lng, listo]);

  useEffect(() => {
    if (!listo) return;
    const marca = marcaRef.current;
    if (!marca) return;
    if (radioKm == null || radioKm <= 0) {
      circuloRef.current?.remove();
      circuloRef.current = null;
      return;
    }
    if (circuloRef.current) {
      circuloRef.current.setRadius(radioKm * 1000);
      return;
    }
    const punto = marca.getLatLng();
    void import("leaflet").then((L) => {
      const mapa = mapaRef.current as unknown as { addLayer: (capa: unknown) => void } | null;
      if (!mapa || circuloRef.current) return;
      const circulo = L.circle([punto.lat, punto.lng], {
        radius: radioKm * 1000,
        color: "#7f1d1d",
        weight: 2,
        fillOpacity: 0.12,
      });
      mapa.addLayer(circulo);
      circuloRef.current = circulo;
    });
  }, [radioKm, listo]);

  function usarUbicacion() {
    setAviso(null);
    if (!navigator.geolocation) {
      setAviso("Este navegador no comparte la ubicación.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        const siguiente = {
          lat: Number(posicion.coords.latitude.toFixed(6)),
          lng: Number(posicion.coords.longitude.toFixed(6)),
        };
        marcaRef.current?.setLatLng([siguiente.lat, siguiente.lng]);
        circuloRef.current?.setLatLng([siguiente.lat, siguiente.lng]);
        const mapa = mapaRef.current as { setView?: (centro: [number, number], zoom: number) => void } | null;
        mapa?.setView?.([siguiente.lat, siguiente.lng], 15);
        onMove(siguiente.lat, siguiente.lng);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setAviso("No diste permiso para usar tu ubicación. Puedes mover el pin o escribir las coordenadas.");
          return;
        }
        setAviso("No se pudo leer tu ubicación. Mueve el pin o escribe las coordenadas.");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative isolate z-0 h-64 w-full">
        <div
          ref={nodo}
          role="application"
          aria-label="Mapa"
          className="h-64 w-full overflow-hidden rounded-lg border border-[var(--ln)]"
        />
        {listo || fallo ? null : <Skeleton className="absolute inset-0 h-64 w-full" />}
      </div>
      {miUbicacion ? (
        <Button type="button" variant="secundario" onClick={usarUbicacion}>
          Usar mi ubicación
        </Button>
      ) : null}
      {aviso ? (
        <p role="status" className="text-sm leading-6 text-[var(--mu)]">
          {aviso}
        </p>
      ) : null}
      {fallo ? (
        <p className="text-sm leading-6 text-[var(--mu)]">
          El mapa no cargó. Escribe la latitud y la longitud.
        </p>
      ) : (
        <p className="text-sm leading-6 text-[var(--mu)]">
          Arrastra el pin o toca el mapa para colocarlo.
        </p>
      )}
    </div>
  );
}
