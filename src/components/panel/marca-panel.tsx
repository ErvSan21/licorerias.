"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { Campo, claseCampo, useAvisoSalida } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { CargarImagen } from "@/components/ui/cargar-imagen";
import { Marca } from "@/components/ui/marca";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { contrasteSuficiente, nombreVisible, parseColorMarca, type MarcaPublica } from "@/lib/marca/reglas";
import { capitalizar } from "@/lib/texto";

/** Colores sugeridos; solo se ofrecen los que contrastan con el texto de los botones. */
const PALETA = ["#4f7cff", "#0e7490", "#7c3aed", "#be185d", "#b91c1c", "#c2410c", "#15803d", "#1f2937"].filter(
  contrasteSuficiente,
);

export function MarcaPanel({
  slug,
  nombreTienda,
  lectura,
  inicial,
}: {
  slug: string;
  nombreTienda: string;
  lectura: boolean;
  inicial: MarcaPublica;
}) {
  const router = useRouter();
  const publicar = useToast();
  const avisoId = useId();
  const [nombre, setNombre] = useState(inicial.nombreComercial ?? "");
  const [color, setColor] = useState(inicial.colorPrimario ?? PALETA[0] ?? "#4f7cff");
  const [bienvenida, setBienvenida] = useState(inicial.mensajeBienvenida ?? "");
  const [logo, setLogo] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [quitarLogo, setQuitarLogo] = useState(false);
  const [quitarBanner, setQuitarBanner] = useState(false);
  const [vistaLogo, setVistaLogo] = useState<string | null>(null);
  const [vistaBanner, setVistaBanner] = useState<string | null>(null);
  const sucio = useAvisoSalida();
  const colorValido = /^#[0-9A-Fa-f]{6}$/.test(color);
  const colorOk = contrasteSuficiente(color);
  const logoMostrado = vistaLogo ?? (quitarLogo ? null : inicial.logoUrl);
  const bannerMostrado = vistaBanner ?? (quitarBanner ? null : inicial.bannerUrl);
  const titulo = nombreVisible({ ...inicial, nombreComercial: nombre.trim() || null }, nombreTienda);

  // Libera cada vista previa local cuando se reemplaza o al salir.
  useEffect(() => {
    return () => {
      if (vistaLogo) URL.revokeObjectURL(vistaLogo);
    };
  }, [vistaLogo]);
  useEffect(() => {
    return () => {
      if (vistaBanner) URL.revokeObjectURL(vistaBanner);
    };
  }, [vistaBanner]);

  function elegirImagen(
    archivo: File | null,
    setArchivo: (valor: File | null) => void,
    setVista: (valor: string | null) => void,
  ) {
    sucio.marcarSucio();
    setArchivo(archivo);
    setVista(archivo ? URL.createObjectURL(archivo) : null);
  }

  const guardar = useAsyncAction(async () => {
    parseColorMarca(color);
    const datos = new FormData();
    datos.set("nombreComercial", nombre);
    datos.set("colorPrimario", color);
    datos.set("mensajeBienvenida", bienvenida);
    if (logo) datos.set("logo", logo);
    if (banner) datos.set("banner", banner);
    if (quitarLogo && !logo) datos.set("quitarLogo", "1");
    if (quitarBanner && !banner) datos.set("quitarBanner", "1");
    const respuesta = await fetch(`/api/t/${slug}/marca`, { method: "POST", body: datos });
    const cuerpo = (await respuesta.json().catch(() => null)) as { error?: string; marca?: MarcaPublica } | null;
    if (!respuesta.ok || !cuerpo?.marca) {
      throw new Error(cuerpo?.error || "No se pudo guardar. Revisa los datos e inténtalo de nuevo.");
    }
    setLogo(null);
    setBanner(null);
    setVistaLogo(null);
    setVistaBanner(null);
    setQuitarLogo(false);
    setQuitarBanner(false);
    sucio.limpiar();
    return "Marca guardada.";
  });

  function cambiar<T>(setter: (valor: T) => void) {
    return (valor: T) => {
      sucio.marcarSucio();
      setter(valor);
    };
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Vista previa: así se ve la cabecera de la tienda en línea. */}
      <Marca color={colorOk ? color : undefined} className="marca-vista">
        <div className="marca-vista-banner">
          {bannerMostrado ? (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa local o ya guardada
            <img src={bannerMostrado} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="marca-vista-banner-vacio" aria-hidden="true" />
          )}
        </div>
        <div className="marca-vista-cuerpo">
          <span className="marca-vista-logo">
            {logoMostrado ? (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa local o ya guardada
              <img src={logoMostrado} alt="" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden="true">{titulo.charAt(0).toUpperCase()}</span>
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-extrabold">{titulo}</p>
            <p className="text-pretty text-sm leading-6 text-[var(--mu)]">
              {bienvenida.trim() || "Aquí aparece tu mensaje de bienvenida."}
            </p>
          </div>
          <span aria-hidden="true" className="marca-vista-boton">
            Realizar pedido
          </span>
        </div>
        <p className="marca-vista-nota">Vista previa de tu tienda en línea</p>
      </Marca>

      {lectura ? (
        <p className="text-sm text-[var(--mu)]">La licencia no está vigente. La marca está en solo lectura.</p>
      ) : null}

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!event.currentTarget.reportValidity()) return;
          void guardar.run().then((hecho) => {
            if (hecho.omitida || !hecho.valor.ok) return;
            publicar("exito", hecho.valor.valor);
            router.refresh();
          });
        }}
      >
        <section className="dashboard-tarjeta flex flex-col gap-3">
          <h3 className="!mb-0">Identidad</h3>
          <Campo id="marca-nombre" etiqueta="Nombre comercial" ayuda={`Si lo dejas vacío, se usa «${nombreTienda}».`}>
            <input
              id="marca-nombre"
              autoComplete="organization"
              autoCapitalize="words"
              maxLength={60}
              disabled={lectura}
              value={nombre}
              onChange={(event) => cambiar(setNombre)(capitalizar(event.target.value))}
              className={claseCampo}
            />
          </Campo>
          <Campo id="marca-bienvenida" etiqueta="Mensaje de bienvenida" ayuda="Se ve en la tienda y en el saludo de WhatsApp.">
            <textarea
              id="marca-bienvenida"
              autoComplete="off"
              maxLength={280}
              rows={3}
              disabled={lectura}
              value={bienvenida}
              onChange={(event) => cambiar(setBienvenida)(capitalizar(event.target.value))}
              className={`${claseCampo} h-auto py-2`}
            />
          </Campo>
        </section>

        <section className="dashboard-tarjeta flex flex-col gap-3">
          <h3 className="!mb-0">Color</h3>
          <div role="radiogroup" aria-label="Colores sugeridos" className="flex flex-wrap gap-2.5">
            {PALETA.map((opcion) => {
              const activo = opcion.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={opcion}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  aria-label={opcion}
                  disabled={lectura}
                  onClick={() => cambiar(setColor)(opcion)}
                  className={`marca-muestra ${activo ? "marca-muestra-activa" : ""}`}
                  style={{ background: opcion }}
                />
              );
            })}
          </div>
          <Campo id="marca-color" etiqueta="Color personalizado">
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Elegir color"
                disabled={lectura}
                value={colorValido ? color : "#4f7cff"}
                onChange={(event) => cambiar(setColor)(event.target.value)}
                className="size-12 shrink-0 cursor-pointer rounded-lg border border-[var(--campo-ln)] bg-[var(--campo-bg)] p-1"
              />
              <input
                id="marca-color"
                autoComplete="off"
                spellCheck={false}
                maxLength={7}
                disabled={lectura}
                value={color}
                aria-describedby={colorOk ? undefined : avisoId}
                onChange={(event) => cambiar(setColor)(event.target.value)}
                className={`${claseCampo} font-mono uppercase`}
              />
            </div>
          </Campo>
          {!colorOk ? (
            <p id={avisoId} role="alert" className="text-sm text-[var(--er)]">
              {colorValido
                ? "Ese color no contrasta con el texto de los botones. Elige uno más oscuro o más claro."
                : "Escribe un color en formato #RRGGBB."}
            </p>
          ) : null}
        </section>

        <section className="dashboard-tarjeta flex flex-col gap-4">
          <h3 className="!mb-0">Imágenes</h3>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Logo</span>
            <CargarImagen
              actual={quitarLogo ? null : inicial.logoUrl}
              etiqueta="Cargar logo"
              deshabilitado={lectura}
              onChange={(archivo) => elegirImagen(archivo, setLogo, setVistaLogo)}
              alQuitarActual={inicial.logoUrl ? () => cambiar(setQuitarLogo)(true) : undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Banner</span>
            <CargarImagen
              actual={quitarBanner ? null : inicial.bannerUrl}
              etiqueta="Cargar banner"
              deshabilitado={lectura}
              onChange={(archivo) => elegirImagen(archivo, setBanner, setVistaBanner)}
              alQuitarActual={inicial.bannerUrl ? () => cambiar(setQuitarBanner)(true) : undefined}
            />
          </div>
        </section>

        {guardar.error ? (
          <p role="alert" className="text-sm text-[var(--er)]">
            {guardar.error}
          </p>
        ) : null}
        <Button
          type="submit"
          loading={guardar.loading}
          loadingLabel="Guardando…"
          success={guardar.success}
          disabled={lectura || !colorOk}
        >
          Guardar cambios
        </Button>
      </form>
    </div>
  );
}
