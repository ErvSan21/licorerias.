"use client";

import { useEffect, useId, useState } from "react";

import { Campo, claseCampo, useAvisoSalida } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { ImagenConCarga } from "@/components/ui/imagen";
import { Marca } from "@/components/ui/marca";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { contrasteSuficiente, nombreVisible, parseColorMarca, type MarcaPublica } from "@/lib/marca/reglas";

export function MarcaPanel({
  slug,
  lectura,
  inicial,
}: {
  slug: string;
  lectura: boolean;
  inicial: MarcaPublica;
}) {
  const avisoId = useId();
  const [nombre, setNombre] = useState(inicial.nombreComercial ?? "");
  const [color, setColor] = useState(inicial.colorPrimario ?? "#3f3f46");
  const [bienvenida, setBienvenida] = useState(inicial.mensajeBienvenida ?? "");
  const [quitarLogo, setQuitarLogo] = useState(false);
  const [quitarBanner, setQuitarBanner] = useState(false);
  const [logoLocal, setLogoLocal] = useState<string | null>(null);
  const [bannerLocal, setBannerLocal] = useState<string | null>(null);
  const [avisoColor, setAvisoColor] = useState<string | null>(null);
  const sucio = useAvisoSalida();
  const colorOk = contrasteSuficiente(color);
  const logo = logoLocal || (!quitarLogo ? inicial.logoUrl : null);
  const banner = bannerLocal || (!quitarBanner ? inicial.bannerUrl : null);

  useEffect(() => {
    return () => {
      if (logoLocal) URL.revokeObjectURL(logoLocal);
      if (bannerLocal) URL.revokeObjectURL(bannerLocal);
    };
  }, [logoLocal, bannerLocal]);

  const guardar = useAsyncAction(async () => {
    setAvisoColor(null);
    try {
      parseColorMarca(color);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : "Elige un color con más contraste.";
      setAvisoColor(mensaje);
      document.getElementById("marca-color")?.focus();
      throw new Error(mensaje);
    }
    const datos = new FormData(document.getElementById("marca-form") as HTMLFormElement);
    datos.set("colorPrimario", color);
    const respuesta = await fetch(`/api/t/${slug}/marca`, { method: "POST", body: datos });
    const cuerpo = (await respuesta.json().catch(() => null)) as { error?: string; marca?: MarcaPublica } | null;
    if (!respuesta.ok || !cuerpo?.marca) {
      throw new Error(cuerpo?.error || "No se pudo guardar. Revisa los datos e inténtalo de nuevo.");
    }
    setLogoLocal(null);
    setBannerLocal(null);
    setQuitarLogo(false);
    setQuitarBanner(false);
    sucio.limpiar();
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        id="marca-form"
        className="flex max-w-lg flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void guardar.run();
        }}
        onChange={() => sucio.marcarSucio()}
      >
        <Campo id="marca-nombre" etiqueta="Nombre comercial" ayuda="Si lo dejas vacío, la tienda usa su nombre.">
          <input
            id="marca-nombre"
            name="nombreComercial"
            autoComplete="organization"
            maxLength={60}
            disabled={lectura}
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            className={claseCampo}
          />
        </Campo>
        <Campo id="marca-color" etiqueta="Color" ayuda="Tiene que contrastar con el texto de los botones.">
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Elegir color"
              disabled={lectura}
              value={/^#[0-9A-Fa-f]{6}$/.test(color) ? color : "#3f3f46"}
              onChange={(event) => setColor(event.target.value)}
              className="size-12 shrink-0 cursor-pointer rounded-lg border border-zinc-300 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <input
              id="marca-color"
              name="colorPrimario"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              maxLength={7}
              disabled={lectura}
              value={color}
              aria-describedby={avisoColor ? avisoId : undefined}
              onChange={(event) => setColor(event.target.value)}
              className={claseCampo}
            />
          </div>
        </Campo>
        {avisoColor ? (
          <p id={avisoId} role="alert" className="text-sm text-red-800 dark:text-red-300">
            {avisoColor}
          </p>
        ) : null}
        <Campo id="marca-bienvenida" etiqueta="Mensaje de bienvenida">
          <textarea
            id="marca-bienvenida"
            name="mensajeBienvenida"
            autoComplete="off"
            maxLength={280}
            rows={3}
            disabled={lectura}
            value={bienvenida}
            onChange={(event) => setBienvenida(event.target.value)}
            className={`${claseCampo} h-auto py-2`}
          />
        </Campo>
        <Campo id="marca-logo" etiqueta="Logo">
          <input
            id="marca-logo"
            name="logo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={lectura}
            onChange={(event) => {
              const archivo = event.target.files?.[0];
              if (logoLocal) URL.revokeObjectURL(logoLocal);
              setLogoLocal(archivo ? URL.createObjectURL(archivo) : null);
              setQuitarLogo(false);
            }}
            className={claseCampo}
          />
        </Campo>
        {inicial.logoUrl ? (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="quitarLogo"
              value="1"
              checked={quitarLogo}
              disabled={lectura}
              onChange={(event) => setQuitarLogo(event.target.checked)}
            />
            Quitar logo
          </label>
        ) : null}
        <Campo id="marca-banner" etiqueta="Banner">
          <input
            id="marca-banner"
            name="banner"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={lectura}
            onChange={(event) => {
              const archivo = event.target.files?.[0];
              if (bannerLocal) URL.revokeObjectURL(bannerLocal);
              setBannerLocal(archivo ? URL.createObjectURL(archivo) : null);
              setQuitarBanner(false);
            }}
            className={claseCampo}
          />
        </Campo>
        {inicial.bannerUrl ? (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="quitarBanner"
              value="1"
              checked={quitarBanner}
              disabled={lectura}
              onChange={(event) => setQuitarBanner(event.target.checked)}
            />
            Quitar banner
          </label>
        ) : null}
        <Button
          type="submit"
          loading={guardar.loading}
          loadingLabel="Guardando…"
          success={guardar.success}
          error={guardar.error ?? false}
          disabled={lectura}
        >
          Guardar marca
        </Button>
      </form>
      <Marca color={colorOk ? color : undefined} className="flex max-w-lg flex-col gap-3">
        <h3 className="text-pretty text-sm font-semibold">Vista previa</h3>
        {banner ? (
          <ImagenConCarga src={banner} alt="" width={640} height={200} className="h-32 w-full" />
        ) : (
          <Skeleton className="h-32 w-full rounded-lg" />
        )}
        <div className="flex min-w-0 items-center gap-3">
          {logo ? (
            <ImagenConCarga src={logo} alt="" width={48} height={48} className="size-12 shrink-0" />
          ) : (
            <Skeleton className="size-12 rounded-lg" />
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{nombreVisible({ ...inicial, nombreComercial: nombre.trim() || null }, "Tu tienda")}</p>
            <p className="text-pretty text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              {bienvenida.trim() || "El mensaje de bienvenida aparece aquí."}
            </p>
          </div>
        </div>
        <div aria-hidden="true">
          <Button type="button" tabIndex={-1}>
            Ver pedido
          </Button>
        </div>
      </Marca>
    </div>
  );
}
