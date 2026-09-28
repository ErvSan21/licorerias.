"use client";

import { useState } from "react";

import { guardarColeccionAccion } from "@/app/t/[slug]/colecciones/actions";
import { Campo, claseCampo } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { ImagenConCarga } from "@/components/ui/imagen";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { comprimirImagen } from "@/lib/catalogo/imagen-cliente";
import { campoFechaBolivia, etiquetaEstado, type EstadoOferta } from "@/lib/ofertas/reglas";
import type { ColeccionLista } from "@/lib/ofertas/servicio";

type Producto = { id: string; nombre: string };

export function ColeccionesPanel({
  slug,
  lectura,
  colecciones,
  productos,
}: {
  slug: string;
  lectura: boolean;
  colecciones: ColeccionLista[];
  productos: Producto[];
}) {
  return (
    <div className="flex flex-col gap-6">
      {lectura ? null : <FormularioColeccion slug={slug} productos={productos} coleccion={null} />}
      {colecciones.length === 0 ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">Todavía no hay colecciones.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {colecciones.map((coleccion) => (
            <li key={coleccion.id} className="[content-visibility:auto] [contain-intrinsic-size:auto_12rem]">
              <TarjetaColeccion slug={slug} coleccion={coleccion} lectura={lectura} productos={productos} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TarjetaColeccion({
  slug,
  coleccion,
  lectura,
  productos,
}: {
  slug: string;
  coleccion: ColeccionLista;
  lectura: boolean;
  productos: Producto[];
}) {
  const [editando, setEditando] = useState(false);
  const nombres = new Map(productos.map((producto) => [producto.id, producto.nombre]));
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      {coleccion.imagenUrl ? (
        <ImagenConCarga src={coleccion.imagenUrl} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />
      ) : null}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-pretty text-base font-semibold">{coleccion.nombre}</h3>
        <Etiqueta estado={coleccion.estado} />
      </div>
      {coleccion.descripcion ? (
        <p className="text-pretty text-sm leading-6 text-zinc-700 dark:text-zinc-300">{coleccion.descripcion}</p>
      ) : null}
      <p className="text-sm text-zinc-700 dark:text-zinc-300">
        {coleccion.productoIds.length === 0
          ? "Sin productos"
          : coleccion.productoIds.map((id) => nombres.get(id) ?? "Producto").join(", ")}
      </p>
      {lectura ? null : editando ? (
        <FormularioColeccion
          slug={slug}
          productos={productos}
          coleccion={coleccion}
          alCerrar={() => setEditando(false)}
        />
      ) : (
        <Button type="button" variant="secundario" onClick={() => setEditando(true)}>
          Editar
        </Button>
      )}
    </article>
  );
}

function FormularioColeccion({
  slug,
  productos,
  coleccion,
  alCerrar,
}: {
  slug: string;
  productos: Producto[];
  coleccion: ColeccionLista | null;
  alCerrar?: () => void;
}) {
  const publicar = useToast();
  const idForm = coleccion ? `coleccion-${coleccion.id}` : "coleccion-nueva";
  const { run, loading, error, success } = useAsyncAction(async () => {
    const formulario = document.getElementById(idForm) as HTMLFormElement;
    const datos = new FormData(formulario);
    const archivo = datos.get("imagen");
    if (archivo instanceof File && archivo.size > 0) {
      datos.set("imagen", await comprimirImagen(archivo));
    }
    const resultado = await guardarColeccionAccion(slug, datos);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  return (
    <form
      id={idForm}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.reportValidity()) return;
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          publicar("exito", hecho.valor.valor);
          if (!coleccion) event.currentTarget.reset();
          alCerrar?.();
        });
      }}
    >
      {coleccion ? <input type="hidden" name="id" value={coleccion.id} /> : null}
      <h3 className="text-pretty text-base font-semibold">{coleccion ? "Editar colección" : "Nueva colección"}</h3>
      <Campo id={`${idForm}-nombre`} etiqueta="Nombre">
        <input
          id={`${idForm}-nombre`}
          name="nombre"
          required
          minLength={2}
          maxLength={80}
          autoComplete="off"
          defaultValue={coleccion?.nombre ?? ""}
          className={claseCampo}
        />
      </Campo>
      <Campo id={`${idForm}-descripcion`} etiqueta="Descripción">
        <textarea
          id={`${idForm}-descripcion`}
          name="descripcion"
          maxLength={400}
          rows={3}
          defaultValue={coleccion?.descripcion ?? ""}
          className={`${claseCampo} h-auto py-2`}
        />
      </Campo>
      <Campo id={`${idForm}-inicio`} etiqueta="Empieza">
        <input
          id={`${idForm}-inicio`}
          name="inicio"
          type="datetime-local"
          required
          autoComplete="off"
          defaultValue={coleccion ? campoFechaBolivia(coleccion.inicio) : ""}
          className={claseCampo}
        />
      </Campo>
      <Campo id={`${idForm}-fin`} etiqueta="Termina">
        <input
          id={`${idForm}-fin`}
          name="fin"
          type="datetime-local"
          required
          autoComplete="off"
          defaultValue={coleccion ? campoFechaBolivia(coleccion.fin) : ""}
          className={claseCampo}
        />
      </Campo>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Productos</legend>
        {productos.length === 0 ? (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">Crea un producto antes de armar la colección.</p>
        ) : (
          productos.map((producto) => (
            <label key={producto.id} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="producto"
                value={producto.id}
                defaultChecked={coleccion?.productoIds.includes(producto.id) ?? false}
              />
              {producto.nombre}
            </label>
          ))
        )}
      </fieldset>
      <Campo id={`${idForm}-imagen`} etiqueta="Imagen" ayuda="Opcional. Se reduce a 800 px antes de subirla.">
        <input
          id={`${idForm}-imagen`}
          name="imagen"
          type="file"
          accept="image/*"
          aria-describedby={`${idForm}-imagen-ayuda`}
          className="block min-h-11 w-full text-sm"
        />
      </Campo>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="activa" defaultChecked={coleccion ? coleccion.activa : true} />
        Activa
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={loading} loadingLabel="Guardando…" success={success} error={error ?? false}>
          Guardar colección
        </Button>
        {alCerrar ? (
          <Button type="button" variant="fantasma" onClick={alCerrar}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function Etiqueta({ estado }: { estado: EstadoOferta }) {
  const tono =
    estado === "vigente"
      ? "text-emerald-800 dark:text-emerald-200"
      : estado === "programada"
        ? "text-sky-800 dark:text-sky-200"
        : "text-zinc-600 dark:text-zinc-400";
  return <p className={`text-sm font-medium ${tono}`}>{etiquetaEstado(estado)}</p>;
}
