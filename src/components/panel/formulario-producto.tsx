"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  crearCategoriaAccion,
  crearProductoAccion,
  eliminarProductoAccion,
  guardarProductoAccion,
} from "@/app/t/[slug]/productos/actions";
import { Campo, useAvisoSalida } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ImagenConCarga } from "@/components/ui/imagen";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { comprimirImagen } from "@/lib/catalogo/imagen-cliente";
import type { CategoriaLista, ProductoLista, SucursalCatalogo } from "@/lib/catalogo/tipos";

const claseCampo =
  "h-12 w-full rounded-lg border border-[var(--campo-ln)] bg-[var(--campo-bg)] px-3 text-base text-[var(--campo-tx)]";

export function FormularioNuevoProducto({
  slug,
  lectura,
  categorias,
  sucursales,
}: {
  slug: string;
  lectura: boolean;
  categorias: CategoriaLista[];
  sucursales: SucursalCatalogo[];
}) {
  return (
    <FormularioProducto
      slug={slug}
      lectura={lectura}
      categorias={categorias}
      sucursales={sucursales}
      producto={null}
      onSubmit={async (datos) => crearProductoAccion(slug, datos)}
    />
  );
}

export function FormularioEditarProducto({
  slug,
  lectura,
  categorias,
  sucursales,
  producto,
}: {
  slug: string;
  lectura: boolean;
  categorias: CategoriaLista[];
  sucursales: SucursalCatalogo[];
  producto: ProductoLista;
}) {
  return (
    <FormularioProducto
      slug={slug}
      lectura={lectura}
      categorias={categorias}
      sucursales={sucursales}
      producto={producto}
      onSubmit={async (datos) => guardarProductoAccion(slug, producto.id, datos)}
    />
  );
}

export function FormularioCategoria({ slug, lectura }: { slug: string; lectura: boolean }) {
  const [nombre, setNombre] = useState("");
  const publicar = useToast();
  const { run, loading, error, success } = useAsyncAction(async () => {
    const resultado = await crearCategoriaAccion(slug, nombre);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado;
  });

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        if (lectura) return;
        if (!event.currentTarget.reportValidity()) return;
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          setNombre("");
          publicar("exito", hecho.valor.valor.aviso);
        });
      }}
    >
      <Campo id="nueva-categoria-lista" etiqueta="Nueva categoría">
        <input
          id="nueva-categoria-lista"
          name="nombre"
          required
          minLength={2}
          maxLength={80}
          autoComplete="off"
          value={nombre}
          disabled={lectura}
          onChange={(event) => setNombre(event.target.value)}
          className={claseCampo}
        />
      </Campo>
      <Button type="submit" variant="secundario" loading={loading} success={success} error={error ?? false} disabled={lectura}>
        Agregar
      </Button>
    </form>
  );
}

function FormularioProducto({
  slug,
  lectura,
  categorias,
  sucursales,
  producto,
  onSubmit,
}: {
  slug: string;
  lectura: boolean;
  categorias: CategoriaLista[];
  sucursales: SucursalCatalogo[];
  producto: ProductoLista | null;
  onSubmit: (datos: FormData) => Promise<{ ok: true; aviso: string; id?: string } | { ok: false; error: string }>;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const publicar = useToast();
  const salida = useAvisoSalida();
  const [vista, setVista] = useState<string | null>(producto?.imagenUrl ?? null);
  useEffect(() => {
    return () => {
      if (vista?.startsWith("blob:")) URL.revokeObjectURL(vista);
    };
  }, [vista]);
  const ofrecidas = new Set(producto?.ofertas.filter((oferta) => oferta.disponible).map((oferta) => oferta.sucursalId));
  const { run, loading, error, success } = useAsyncAction(async () => {
    const datos = new FormData(formulario.current ?? undefined);
    const archivo = datos.get("imagen");
    if (archivo instanceof File && archivo.size > 0) {
      datos.set("imagen", await comprimirImagen(archivo));
    }
    const resultado = await onSubmit(datos);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado;
  });

  return (
    <form
      ref={formulario}
      className="flex flex-col gap-4"
      onInput={salida.marcarSucio}
      onSubmit={(event) => {
        event.preventDefault();
        if (lectura) return;
        if (!event.currentTarget.reportValidity()) return;
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          salida.limpiar();
          publicar("exito", hecho.valor.valor.aviso);
          if (!producto && hecho.valor.valor.id) {
            router.push(`/t/${slug}/productos/${hecho.valor.valor.id}`);
          } else {
            router.refresh();
          }
        });
      }}
    >
      <Campo id="nombre-producto" etiqueta="Nombre">
        <input
          id="nombre-producto"
          name="nombre"
          required
          minLength={2}
          maxLength={120}
          autoComplete="off"
          defaultValue={producto?.nombre ?? ""}
          disabled={lectura}
          className={claseCampo}
        />
      </Campo>
      <Campo id="descripcion-producto" etiqueta="Descripción">
        <textarea
          id="descripcion-producto"
          name="descripcion"
          rows={3}
          maxLength={500}
          autoComplete="off"
          defaultValue={producto?.descripcion ?? ""}
          disabled={lectura}
          className="w-full rounded-lg border border-[var(--campo-ln)] bg-[var(--campo-bg)] px-3 py-2 text-base text-[var(--campo-tx)]"
        />
      </Campo>
      <Campo id="categoria-producto" etiqueta="Categoría">
        <select
          id="categoria-producto"
          name="categoriaId"
          defaultValue={producto?.categoriaId ?? ""}
          disabled={lectura}
          className={claseCampo}
        >
          <option value="">Sin categoría</option>
          {categorias
            .filter((categoria) => categoria.activa || categoria.id === producto?.categoriaId)
            .map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
        </select>
      </Campo>
      <Campo id="nueva-categoria" etiqueta="O crea una categoría" ayuda="Si escribes un nombre, se usa esa categoría.">
        <input
          id="nueva-categoria"
          name="nuevaCategoria"
          maxLength={80}
          autoComplete="off"
          aria-describedby="nueva-categoria-ayuda"
          disabled={lectura}
          className={claseCampo}
        />
      </Campo>
      <Campo id="precio-central" etiqueta="Precio central" ayuda="En Bs. Las sucursales que no fijen el suyo usan este.">
        <input
          id="precio-central"
          name="precioCentral"
          required
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          min={0}
          step="0.01"
          defaultValue={producto ? producto.precioCentral.toFixed(2) : ""}
          aria-describedby="precio-central-ayuda"
          disabled={lectura}
          className={`${claseCampo} tabular-nums`}
        />
      </Campo>
      <fieldset className="flex flex-col gap-2" disabled={lectura}>
        <legend className="text-sm font-medium">Se ofrece en</legend>
        {sucursales.length === 0 ? (
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">Todavía no hay sucursales.</p>
        ) : (
          sucursales.map((sucursal) => (
            <label key={sucursal.id} className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="sucursal"
                value={sucursal.id}
                defaultChecked={!producto || ofrecidas.has(sucursal.id)}
                className="size-5"
              />
              <span className="break-words">{sucursal.nombre}</span>
            </label>
          ))
        )}
      </fieldset>
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input type="checkbox" name="activo" value="on" defaultChecked={producto?.activo ?? true} disabled={lectura} className="size-5" />
        Activo
      </label>
      <Campo id="imagen-producto" etiqueta="Imagen" ayuda="Se comprime a 800 px antes de subir.">
        <input
          id="imagen-producto"
          name="imagen"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-describedby="imagen-producto-ayuda"
          disabled={lectura}
          className="block w-full text-sm"
          onChange={(event) => {
            const archivo = event.target.files?.[0];
            if (!archivo) return;
            const url = URL.createObjectURL(archivo);
            setVista((anterior) => {
              if (anterior?.startsWith("blob:")) URL.revokeObjectURL(anterior);
              return url;
            });
          }}
        />
      </Campo>
      {vista ? (
        <ImagenConCarga src={vista} alt={producto?.nombre ?? "Vista previa del producto"} className="aspect-[4/3] max-w-xs" />
      ) : null}
      <Button type="submit" loading={loading} success={success} error={error ?? false} disabled={lectura}>
        {producto ? "Guardar producto" : "Crear producto"}
      </Button>
      {producto ? <EliminarProducto slug={slug} productoId={producto.id} nombre={producto.nombre} lectura={lectura} /> : null}
    </form>
  );
}

function EliminarProducto({
  slug,
  productoId,
  nombre,
  lectura,
}: {
  slug: string;
  productoId: string;
  nombre: string;
  lectura: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const publicar = useToast();

  return (
    <>
      <Button type="button" variant="peligro" disabled={lectura} onClick={() => setAbierto(true)}>
        Eliminar producto
      </Button>
      <ConfirmDialog
        abierto={abierto}
        titulo="Eliminar producto"
        descripcion={`Se borra “${nombre}”, su imagen y el historial de precios.`}
        etiquetaConfirmar="Eliminar"
        peligro
        cargando={cargando}
        error={error}
        alCerrar={() => {
          if (!cargando) setAbierto(false);
        }}
        alConfirmar={() => {
          setCargando(true);
          setError(null);
          void eliminarProductoAccion(slug, productoId).then((resultado) => {
            setCargando(false);
            if (!resultado.ok) {
              setError(resultado.error);
              return;
            }
            setAbierto(false);
            publicar("exito", resultado.aviso);
            router.push(`/t/${slug}/productos`);
          });
        }}
      />
    </>
  );
}
