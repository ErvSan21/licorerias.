"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipCategoria } from "@/components/ui/chip-categoria";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ImagenConCarga } from "@/components/ui/imagen";
import { InlineLoader } from "@/components/ui/inline-loader";
import { ItemMenu } from "@/components/ui/item-menu";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Marca } from "@/components/ui/marca";
import { Modal } from "@/components/ui/modal";
import {
  EntradaLista,
  IconoConSalto,
  LineaTiempo,
  ResalteFila,
  ResultadosAtenuados,
  useSalto,
} from "@/components/ui/movimientos";
import { PageLoader } from "@/components/ui/page-loader";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectorCantidad } from "@/components/ui/selector-cantidad";
import {
  Skeleton,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonImage,
  SkeletonTable,
  SkeletonText,
} from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { EtiquetaOferta, Tag } from "@/components/ui/tag";
import { parejaMarca } from "@/components/ui/tema";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { formatoBs } from "@/lib/catalogo/reglas";

const PRODUCTOS = ["Singani", "Vino tinto", "Cerveza", "Whisky", "Ron", "Pisco", "Vodka", "Ginebra", "Espumante"];

const PASOS = ["Recibido", "Preparando", "En camino", "Entregado"];

const CATEGORIAS = ["Todos", "Vinos", "Destilados", "Cervezas"];

const FOTO = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="100%" height="100%" fill="#142038"/><text x="50%" y="52%" fill="#eef3fc" font-family="sans-serif" font-size="42" text-anchor="middle">Licorerías</text></svg>',
)}`;

function esperar(ms: number) {
  return new Promise((resolver) => {
    setTimeout(resolver, ms);
  });
}

export function GaleriaUi() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-8">
      <header className="flex flex-col gap-3">
        <p className="text-sm text-[var(--mu)]">Solo en desarrollo</p>
        <h1 className="text-2xl tracking-tight">Sistema de interfaz</h1>
        <p className="text-sm leading-6 text-[var(--mu)]">
          Tokens, tema claro y oscuro, y piezas de components/ui. La noche es el tema base. El degradado vive en
          acciones y estados; los precios quedan en color de texto.
        </p>
        <SelectorTema />
        <a
          href="/login"
          className="inline-flex min-h-10 items-center text-sm font-medium text-[color-mix(in_srgb,var(--br)_45%,var(--tx))] underline underline-offset-4"
        >
          Ir a entrar
        </a>
      </header>

      <DemoPiezas />
      <Seccion titulo="Spinners">
        <div className="flex items-end gap-4">
          <Spinner size="sm" etiqueta="Cargando, pequeño" />
          <Spinner size="md" etiqueta="Cargando, mediano" />
          <Spinner size="lg" etiqueta="Cargando, grande" />
        </div>
      </Seccion>

      <DemoCarga />
      <DemoMarca />
      <DemoSkeletons />
      <DemoLista />
      <DemoPedido />
      <DemoBotones />
      <DemoDialogos />
    </main>
  );
}

type Tema = "sistema" | "light" | "dark";

function suscribirTema() {
  return () => undefined;
}

function temaDesdeUrl(): Tema {
  const valor = new URLSearchParams(window.location.search).get("tema");
  if (valor === "light" || valor === "dark" || valor === "sistema") return valor;
  return "sistema";
}

function temaServidor(): Tema {
  return "sistema";
}

function SelectorTema() {
  const desdeUrl = useSyncExternalStore(suscribirTema, temaDesdeUrl, temaServidor);
  const [elegido, setElegido] = useState<Tema | null>(null);
  const tema = elegido ?? desdeUrl;

  useEffect(() => {
    const raiz = document.documentElement;
    if (tema === "sistema") delete raiz.dataset.theme;
    else raiz.dataset.theme = tema;
    return () => {
      delete raiz.dataset.theme;
    };
  }, [tema]);

  function cambiar(siguiente: Tema) {
    setElegido(siguiente);
    const url = new URL(window.location.href);
    if (siguiente === "sistema") url.searchParams.delete("tema");
    else url.searchParams.set("tema", siguiente);
    window.history.replaceState(null, "", url);
  }

  return (
    <SegmentedControl
      etiqueta="Tema de la galería"
      valor={tema}
      onChange={cambiar}
      opciones={[
        { valor: "sistema", etiqueta: "Sistema" },
        { valor: "light", etiqueta: "Claro" },
        { valor: "dark", etiqueta: "Oscuro" },
      ]}
    />
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg tracking-tight">{titulo}</h2>
      {children}
    </section>
  );
}

function DemoPiezas() {
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [cantidad, setCantidad] = useState(1);

  return (
    <Seccion titulo="Piezas">
      <div className="flex flex-wrap gap-2">
        <Tag>Neutro</Tag>
        <Tag tono="ok">Ok</Tag>
        <Tag tono="warn">Aviso</Tag>
        <Tag tono="danger">Peligro</Tag>
        <Tag tono="brand">Marca</Tag>
        <EtiquetaOferta />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Categorías">
        {CATEGORIAS.map((nombre) => (
          <ChipCategoria key={nombre} activo={categoria === nombre} onClick={() => setCategoria(nombre)}>
            {nombre}
          </ChipCategoria>
        ))}
      </div>
      <p className="text-sm text-[var(--mu)]" aria-live="polite">
        Categoría: {categoria}
      </p>
      <Card className="flex flex-col gap-4 p-4">
        <div className="ui-banner px-4 py-5">
          <p className="text-sm text-[var(--mu)]">Banner</p>
          <p className="text-lg">Noche en la tienda</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p>Singani</p>
          <p className="font-semibold tabular-nums">{formatoBs(120)}</p>
        </div>
        <SelectorCantidad valor={cantidad} onChange={setCantidad} />
      </Card>
      <div className="flex max-w-xs flex-col gap-1">
        <ItemMenu activo>Resumen</ItemMenu>
        <ItemMenu>Pedidos</ItemMenu>
      </div>
      <Table etiqueta="Precios de ejemplo">
        <thead>
          <tr>
            <th scope="col">Producto</th>
            <th scope="col">Precio</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Vino tinto</td>
            <td className="tabular-nums">{formatoBs(64.5)}</td>
          </tr>
          <tr>
            <td>
              <span className="inline-flex items-center gap-2">
                Whisky <EtiquetaOferta />
              </span>
            </td>
            <td className="tabular-nums">{formatoBs(180)}</td>
          </tr>
        </tbody>
      </Table>
    </Seccion>
  );
}

function DemoCarga() {
  const [pantalla, setPantalla] = useState(false);
  const [zona, setZona] = useState(false);
  const [envio, setEnvio] = useState(false);
  const zonaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const envioTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <Seccion titulo="Carga">
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="secundario"
          onClick={() => {
            setPantalla(true);
            setTimeout(() => setPantalla(false), 1200);
          }}
        >
          Ver carga de página
        </Button>
        <PageLoader activo={pantalla} />
        <Card className="relative min-h-28 p-4">
          <p className="text-sm">Sección con overlay mientras se guarda.</p>
          <Button
            type="button"
            className="mt-3"
            onClick={() => {
              setZona(true);
              if (zonaTimer.current) clearTimeout(zonaTimer.current);
              zonaTimer.current = setTimeout(() => setZona(false), 900);
            }}
          >
            Guardar sección
          </Button>
          <LoadingOverlay activo={zona} etiqueta="Guardando…" />
        </Card>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secundario"
            onClick={() => {
              setEnvio(true);
              if (envioTimer.current) clearTimeout(envioTimer.current);
              envioTimer.current = setTimeout(() => setEnvio(false), 900);
            }}
          >
            Calcular envío
          </Button>
          <InlineLoader activo={envio}>Calculando envío…</InlineLoader>
        </div>
      </div>
    </Seccion>
  );
}

function DemoMarca() {
  const [color, setColor] = useState("#4f7cff");
  const pareja = parejaMarca(color);
  const ajustado = pareja ? pareja.br !== color.toLowerCase() : false;

  return (
    <Seccion titulo="Marca">
      <label htmlFor="color-marca" className="flex flex-col gap-1 text-sm font-medium">
        Color de marca
        <input
          id="color-marca"
          name="color-marca"
          type="color"
          autoComplete="off"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          className="h-12 w-20 cursor-pointer rounded-[12px] border border-[var(--ln)] bg-[var(--sf)] p-1"
        />
      </label>
      <p className="text-sm text-[var(--mu)]" aria-live="polite">
        {pareja
          ? ajustado
            ? `El degradado se oscureció para que el texto blanco contraste. Se inyectan ${pareja.br} y ${pareja.br2}. El color guardado no cambia.`
            : `Segundo color derivado: ${pareja.br2}. No se guarda.`
          : "El color tiene que ser #RRGGBB."}
      </p>
      <Marca color={color} className="flex flex-col gap-3">
        <Spinner etiqueta="Color de marca" />
        <Skeleton className="h-4 w-40" />
        <Button type="button">Botón de marca</Button>
      </Marca>
    </Seccion>
  );
}

function DemoSkeletons() {
  return (
    <Seccion titulo="Skeletons">
      <div aria-hidden="true" className="flex flex-col gap-4">
        <Skeleton className="h-4 w-1/2" />
        <SkeletonText lineas={3} />
        <div className="flex items-center gap-3">
          <SkeletonAvatar />
          <SkeletonText lineas={2} />
        </div>
        <SkeletonImage />
        <SkeletonCard />
        <SkeletonTable filas={3} columnas={3} />
      </div>
    </Seccion>
  );
}

function DemoLista() {
  const [consulta, setConsulta] = useState("");
  const [aplicada, setAplicada] = useState("");
  const [actualizando, setActualizando] = useState(false);
  const [fallo, setFallo] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibles = PRODUCTOS.filter((nombre) => nombre.toLocaleLowerCase("es-BO").includes(aplicada.toLocaleLowerCase("es-BO")));

  return (
    <Seccion titulo="Listas, vacío y error">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="busqueda" className="text-sm font-medium">
          Buscar en la lista
        </label>
        <input
          id="busqueda"
          name="q"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          value={consulta}
          onChange={(event) => {
            const valor = event.target.value;
            setConsulta(valor);
            setActualizando(true);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => {
              setAplicada(valor);
              setActualizando(false);
            }, 400);
          }}
          className="ui-campo"
        />
      </div>
      <ResultadosAtenuados actualizando={actualizando}>
        {fallo ? (
          <ErrorState onRetry={() => setFallo(false)} />
        ) : visibles.length === 0 ? (
          <EmptyState titulo="No hay productos" descripcion="Prueba con otro nombre." />
        ) : (
          <ul className="flex flex-col gap-2">
            {visibles.map((nombre, indice) => (
              <EntradaLista key={nombre} indice={indice}>
                <span className="ui-tarjeta block px-3 py-3 text-sm">{nombre}</span>
              </EntradaLista>
            ))}
          </ul>
        )}
      </ResultadosAtenuados>
      <Button type="button" variant="fantasma" onClick={() => setFallo(true)}>
        Simular error
      </Button>
      <ImagenConCarga src={FOTO} alt="Muestra de la marca Licorerías" />
    </Seccion>
  );
}

function DemoPedido() {
  const salto = useSalto();
  const [cantidad, setCantidad] = useState(0);
  const [paso, setPaso] = useState(0);
  const [fila, setFila] = useState(0);

  return (
    <Seccion titulo="Movimiento">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          icon={
            <IconoConSalto ciclo={salto.ciclo}>
              <Bolsa />
            </IconoConSalto>
          }
          onClick={() => {
            salto.saltar();
            setCantidad((valor) => valor + 1);
          }}
        >
          Agregar
        </Button>
        <p className="text-sm" aria-live="polite">
          En el carrito: <span className="ui-entrada-pagina font-semibold tabular-nums">{cantidad}</span>
        </p>
      </div>
      <LineaTiempo pasos={PASOS} actual={paso} />
      <div className="flex gap-2">
        <Button type="button" variant="secundario" disabled={paso === 0} onClick={() => setPaso((valor) => valor - 1)}>
          Anterior
        </Button>
        <Button
          type="button"
          variant="secundario"
          disabled={paso === PASOS.length - 1}
          onClick={() => setPaso((valor) => valor + 1)}
        >
          Siguiente
        </Button>
      </div>
      <ResalteFila clave={fila}>
        <p className="ui-tarjeta px-3 py-3 text-sm">Pedido de mostrador</p>
      </ResalteFila>
      <Button type="button" variant="secundario" onClick={() => setFila((valor) => valor + 1)}>
        Simular pedido nuevo
      </Button>
    </Seccion>
  );
}

function Bolsa() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 8h12l-1 12H7L6 8Zm3 0V7a3 3 0 0 1 6 0v1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DemoBotones() {
  const publicar = useToast();
  const guardar = useAsyncAction(async () => {
    await esperar(700);
  });
  const fallar = useAsyncAction(async () => {
    await esperar(400);
    throw new Error("No se pudo guardar. Inténtalo de nuevo.");
  });

  return (
    <Seccion titulo="Botones">
      <div className="flex flex-col gap-3">
        <Button type="button" variant="primario">
          Primario
        </Button>
        <Button type="button" variant="secundario">
          Secundario
        </Button>
        <Button type="button" variant="peligro">
          Peligro
        </Button>
        <Button type="button" variant="fantasma">
          Fantasma
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm">
            Chico
          </Button>
          <Button type="button" size="md">
            Mediano
          </Button>
        </div>
        <Button type="button" disabled>
          Deshabilitado
        </Button>
        <Button type="button" icon={<Bolsa />} variant="secundario">
          Con ícono
        </Button>
        <Button
          type="button"
          loading={guardar.loading}
          success={guardar.success}
          loadingLabel="Guardando…"
          onClick={() => {
            void guardar.run();
          }}
        >
          Guardar
        </Button>
        <Button
          type="button"
          variant="peligro"
          loading={fallar.loading}
          error={fallar.error ?? false}
          loadingLabel="Guardando…"
          onClick={() => {
            void fallar.run();
          }}
        >
          Guardar con error
        </Button>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="secundario" onClick={() => publicar("exito", "Cambios guardados.")}>
            Aviso de éxito
          </Button>
          <Button type="button" variant="secundario" onClick={() => publicar("error", "No se pudo enviar.")}>
            Aviso de error
          </Button>
          <Button type="button" variant="secundario" onClick={() => publicar("aviso", "Revisa los datos.")}>
            Aviso
          </Button>
        </div>
      </div>
    </Seccion>
  );
}

function DemoDialogos() {
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const borrar = useAsyncAction(async () => {
    await esperar(700);
  });

  return (
    <Seccion titulo="Diálogos">
      <div className="flex flex-col gap-2">
        <Button type="button" variant="secundario" onClick={() => setModal(true)}>
          Abrir modal
        </Button>
        <Button type="button" variant="secundario" onClick={() => setDrawer(true)}>
          Abrir panel
        </Button>
        <Button type="button" variant="peligro" onClick={() => setConfirm(true)}>
          Cancelar pedido
        </Button>
      </div>
      <Modal abierto={modal} titulo="Detalle" descripcion="El foco queda dentro hasta cerrar." alCerrar={() => setModal(false)}>
        <p className="text-sm leading-6">Puedes cerrar con Escape o con el botón.</p>
      </Modal>
      <Drawer
        abierto={drawer}
        titulo="Filtros"
        descripcion="En el celular el panel sale desde abajo."
        alCerrar={() => setDrawer(false)}
      >
        <p className="text-sm leading-6">Hoja inferior, radio 22 px arriba. Opacidad y escala, sin sombra pesada.</p>
      </Drawer>
      <ConfirmDialog
        abierto={confirm}
        titulo="¿Cancelar el pedido?"
        descripcion="Esta acción no se puede deshacer."
        etiquetaConfirmar="Cancelar pedido"
        etiquetaCargando="Cancelando…"
        peligro
        cargando={borrar.loading}
        error={borrar.error}
        alCerrar={() => {
          if (!borrar.loading) setConfirm(false);
        }}
        alConfirmar={() => {
          void borrar.run().then((resultado) => {
            if (!resultado.omitida && resultado.valor.ok) setConfirm(false);
          });
        }}
      />
    </Seccion>
  );
}
