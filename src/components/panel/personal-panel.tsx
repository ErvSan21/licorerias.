"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  cambiarContrasenaPersonalAccion,
  crearPersonalAccion,
  eliminarPersonalAccion,
  guardarPersonalAccion,
  suspenderPersonalAccion,
} from "@/app/t/[slug]/actions";
import { PieHoja } from "@/components/administracion/pie-hoja";
import { Campo, claseCampo } from "@/components/super/campo";
import { CampoContrasena } from "@/components/ui/campo-contrasena";
import { Drawer } from "@/components/ui/drawer";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { capitalizar } from "@/lib/texto";
import type { RolTienda } from "@/lib/tenant";
import { BotonAgregar } from "@/components/ui/boton-agregar";

type SucursalOpcion = { id: string; nombre: string };

export type PersonaFila = {
  id: string;
  rol: RolTienda;
  activo: boolean;
  correo: string | null;
  nombre: string | null;
  sucursalIds: string[];
  esYo: boolean;
};

type Hoja = "editar" | "suspender" | "eliminar" | "clave";
type ResultadoAccion = { ok: true; aviso: string } | { ok: false; error: string };

const ROLES: Record<RolTienda, string> = { dueno: "Dueño", gerente: "Gerente", vendedor: "Vendedor" };

export function PersonalPanel({
  slug,
  personas,
  sucursales,
  lectura,
}: {
  slug: string;
  personas: PersonaFila[];
  sucursales: SucursalOpcion[];
  lectura: boolean;
}) {
  const [crear, setCrear] = useState(false);
  // Tú primero; después los activos, y por nombre.
  const ordenadas = personas.toSorted(
    (a, b) =>
      Number(b.esYo) - Number(a.esYo) ||
      Number(b.activo) - Number(a.activo) ||
      (a.nombre ?? a.correo ?? "").localeCompare(b.nombre ?? b.correo ?? "", "es"),
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-pretty text-lg font-semibold">Personal</h2>
        {lectura ? null : (
          <BotonAgregar etiqueta="Crear usuario" alTocar={() => setCrear(true)} />
        )}
      </div>

      <ul className="stock-lista">
        {ordenadas.map((persona) => (
          <li key={persona.id} className="stock-fila">
            <FilaPersona slug={slug} persona={persona} sucursales={sucursales} lectura={lectura} />
          </li>
        ))}
      </ul>

      <Drawer abierto={crear} titulo="Nuevo usuario" alCerrar={() => setCrear(false)}>
        {crear ? <FormularioAlta slug={slug} sucursales={sucursales} alCerrar={() => setCrear(false)} /> : null}
      </Drawer>
    </>
  );
}

function FilaPersona({
  slug,
  persona,
  sucursales,
  lectura,
}: {
  slug: string;
  persona: PersonaFila;
  sucursales: SucursalOpcion[];
  lectura: boolean;
}) {
  const router = useRouter();
  const publicar = useToast();
  const [menu, setMenu] = useState(false);
  const [haciaArriba, setHaciaArriba] = useState(false);
  const [hoja, setHoja] = useState<Hoja | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const titulo = persona.nombre ?? persona.correo ?? "Sin nombre";
  const lugares =
    persona.rol === "dueno"
      ? "Todas las sucursales"
      : sucursales
          .filter((sucursal) => persona.sucursalIds.includes(sucursal.id))
          .map((sucursal) => sucursal.nombre)
          .join(", ") || "Sin sucursal";

  // Cierra la lista al tocar fuera o con Escape.
  useEffect(() => {
    if (!menu) return;
    function fuera(event: PointerEvent) {
      if (!contenedor.current?.contains(event.target as Node)) setMenu(false);
    }
    function tecla(event: KeyboardEvent) {
      if (event.key === "Escape") setMenu(false);
    }
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [menu]);

  function abrir(siguiente: Hoja) {
    setMenu(false);
    setHoja(siguiente);
  }

  function listo(aviso: string) {
    publicar("exito", aviso);
    setHoja(null);
    router.refresh();
  }

  return (
    <>
      <div className={`flex items-center gap-3 ${persona.activo ? "" : "opacity-60"}`}>
        <span aria-hidden="true" className="persona-avatar">
          {titulo.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="break-words font-semibold">{titulo}</p>
            {persona.esYo ? <Tag tono="brand">Tú</Tag> : null}
            {persona.activo ? null : <Tag tono="warn">Suspendido</Tag>}
          </div>
          {persona.nombre && persona.correo ? (
            <p className="break-all text-sm text-[var(--mu)]">{persona.correo}</p>
          ) : null}
          <p className="text-sm text-[var(--mu)]">
            {ROLES[persona.rol]} · {lugares}
          </p>
        </div>
        {lectura || persona.esYo ? null : (
          <div ref={contenedor} className="relative self-start">
            <button
              type="button"
              className="boton-icono"
              aria-label={`Acciones de ${titulo}`}
              aria-haspopup="menu"
              aria-expanded={menu}
              onClick={(event) => {
                const caja = event.currentTarget.getBoundingClientRect();
                setHaciaArriba(caja.bottom > window.innerHeight - 260);
                setMenu((abierto) => !abierto);
              }}
            >
              <span aria-hidden>⋮</span>
            </button>
            {menu ? (
              <ul role="menu" className={`producto-menu ui-movimiento ${haciaArriba ? "producto-menu-arriba" : ""}`}>
                <li role="none">
                  <button type="button" role="menuitem" onClick={() => abrir("editar")}>
                    Editar rol y sucursales
                  </button>
                </li>
                <li role="none">
                  <button type="button" role="menuitem" onClick={() => abrir("clave")}>
                    Cambiar contraseña
                  </button>
                </li>
                <li role="none">
                  <button type="button" role="menuitem" onClick={() => abrir("suspender")}>
                    {persona.activo ? "Suspender" : "Reactivar"}
                  </button>
                </li>
                <li role="none">
                  <button type="button" role="menuitem" className="text-[var(--er)]" onClick={() => abrir("eliminar")}>
                    Eliminar
                  </button>
                </li>
              </ul>
            ) : null}
          </div>
        )}
      </div>

      <Drawer abierto={hoja === "editar"} titulo="Editar usuario" descripcion={titulo} alCerrar={() => setHoja(null)}>
        {hoja === "editar" ? (
          <FormularioEditar slug={slug} persona={persona} sucursales={sucursales} alCerrar={() => setHoja(null)} alListo={listo} />
        ) : null}
      </Drawer>
      <Drawer abierto={hoja === "clave"} titulo="Cambiar contraseña" descripcion={titulo} alCerrar={() => setHoja(null)}>
        {hoja === "clave" ? (
          <FormularioClave slug={slug} miembroId={persona.id} alCerrar={() => setHoja(null)} alListo={listo} />
        ) : null}
      </Drawer>
      <Drawer
        abierto={hoja === "suspender"}
        titulo={persona.activo ? "Suspender usuario" : "Reactivar usuario"}
        descripcion={
          persona.activo
            ? `${titulo} no podrá entrar al panel de esta tienda hasta que lo reactives.`
            : `${titulo} vuelve a entrar al panel con su contraseña.`
        }
        alCerrar={() => setHoja(null)}
      >
        {hoja === "suspender" ? (
          <HojaConfirmar
            ejecutar={() => suspenderPersonalAccion(slug, persona.id, persona.activo)}
            alCerrar={() => setHoja(null)}
            alListo={listo}
          />
        ) : null}
      </Drawer>
      <Drawer
        abierto={hoja === "eliminar"}
        titulo="Eliminar usuario"
        descripcion={`${titulo} sale del personal y pierde el acceso. Las ventas que registró se conservan.`}
        alCerrar={() => setHoja(null)}
      >
        {hoja === "eliminar" ? (
          <HojaConfirmar
            peligro
            ejecutar={() => eliminarPersonalAccion(slug, persona.id)}
            alCerrar={() => setHoja(null)}
            alListo={listo}
          />
        ) : null}
      </Drawer>
    </>
  );
}

function FormularioAlta({
  slug,
  sucursales,
  alCerrar,
}: {
  slug: string;
  sucursales: SucursalOpcion[];
  alCerrar: () => void;
}) {
  const router = useRouter();
  const publicar = useToast();
  const formulario = useRef<HTMLFormElement>(null);
  const [rol, setRol] = useState<RolTienda>("vendedor");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const { run, loading, error } = useAsyncAction(async () => {
    const resultado = await crearPersonalAccion(slug, new FormData(formulario.current ?? undefined));
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  return (
    <form
      ref={formulario}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.reportValidity()) return;
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          publicar("exito", hecho.valor.valor);
          alCerrar();
          router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Campo id="personal-nombre" etiqueta="Nombre">
          <input
            id="personal-nombre"
            name="nombre"
            required
            minLength={2}
            maxLength={60}
            autoComplete="off"
            autoCapitalize="words"
            value={nombre}
            onChange={(event) => setNombre(capitalizar(event.target.value))}
            className={claseCampo}
          />
        </Campo>
        <Campo id="personal-apellido" etiqueta="Apellido">
          <input
            id="personal-apellido"
            name="apellido"
            required
            minLength={2}
            maxLength={60}
            autoComplete="off"
            autoCapitalize="words"
            value={apellido}
            onChange={(event) => setApellido(capitalizar(event.target.value))}
            className={claseCampo}
          />
        </Campo>
      </div>
      <Campo id="personal-correo" etiqueta="Correo">
        <input id="personal-correo" name="correo" type="email" required autoComplete="off" spellCheck={false} className={claseCampo} />
      </Campo>
      <Campo id="personal-celular" etiqueta="Celular (opcional)">
        <input
          id="personal-celular"
          name="celular"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="7XXXXXXX"
          className={claseCampo}
        />
      </Campo>
      <Campo id="personal-clave" etiqueta="Contraseña" ayuda="Mínimo 8 caracteres. Dásela a la persona para que entre.">
        <CampoContrasena
          id="personal-clave"
          name="contrasena"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          className={claseCampo}
        />
      </Campo>
      <CamposRol rol={rol} alCambiarRol={setRol} sucursales={sucursales} marcadas={sucursales.length === 1 ? [sucursales[0].id] : []} />
      {error ? (
        <p role="alert" className="text-sm text-[var(--er)]">
          {error}
        </p>
      ) : null}
      <PieHoja alCancelar={alCerrar} cargando={loading} etiquetaCargando="Creando…" />
    </form>
  );
}

function FormularioEditar({
  slug,
  persona,
  sucursales,
  alCerrar,
  alListo,
}: {
  slug: string;
  persona: PersonaFila;
  sucursales: SucursalOpcion[];
  alCerrar: () => void;
  alListo: (aviso: string) => void;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const [rol, setRol] = useState<RolTienda>(persona.rol);
  const { run, loading, error } = useAsyncAction(async () => {
    const datos = new FormData(formulario.current ?? undefined);
    datos.set("activo", persona.activo ? "on" : "off");
    const resultado = await guardarPersonalAccion(slug, persona.id, datos);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  return (
    <form
      ref={formulario}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          alListo(hecho.valor.valor);
        });
      }}
    >
      <CamposRol rol={rol} alCambiarRol={setRol} sucursales={sucursales} marcadas={persona.sucursalIds} />
      {error ? (
        <p role="alert" className="text-sm text-[var(--er)]">
          {error}
        </p>
      ) : null}
      <PieHoja alCancelar={alCerrar} cargando={loading} />
    </form>
  );
}

function CamposRol({
  rol,
  alCambiarRol,
  sucursales,
  marcadas,
}: {
  rol: RolTienda;
  alCambiarRol: (rol: RolTienda) => void;
  sucursales: SucursalOpcion[];
  marcadas: string[];
}) {
  return (
    <>
      <Campo id="personal-rol" etiqueta="Rol">
        <select
          id="personal-rol"
          name="rol"
          required
          value={rol}
          onChange={(event) => alCambiarRol(event.target.value as RolTienda)}
          className={claseCampo}
        >
          <option value="vendedor">Vendedor</option>
          <option value="gerente">Gerente</option>
          <option value="dueno">Dueño</option>
        </select>
      </Campo>
      {rol === "dueno" ? (
        <p className="text-sm text-[var(--mu)]">Un dueño entra a todas las sucursales.</p>
      ) : (
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium">Sucursales</legend>
          {sucursales.map((sucursal) => (
            <label key={sucursal.id} className="inline-flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="sucursalId" value={sucursal.id} defaultChecked={marcadas.includes(sucursal.id)} />
              {sucursal.nombre}
            </label>
          ))}
        </fieldset>
      )}
    </>
  );
}

function FormularioClave({
  slug,
  miembroId,
  alCerrar,
  alListo,
}: {
  slug: string;
  miembroId: string;
  alCerrar: () => void;
  alListo: (aviso: string) => void;
}) {
  const [contrasena, setContrasena] = useState("");
  const { run, loading, error } = useAsyncAction(async () => {
    const resultado = await cambiarContrasenaPersonalAccion(slug, miembroId, contrasena);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.reportValidity()) return;
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          alListo(hecho.valor.valor);
        });
      }}
    >
      <Campo id={`clave-${miembroId}`} etiqueta="Nueva contraseña" ayuda="Mínimo 8 caracteres.">
        <CampoContrasena
          id={`clave-${miembroId}`}
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          value={contrasena}
          onChange={(event) => setContrasena(event.target.value)}
          className={claseCampo}
        />
      </Campo>
      {error ? (
        <p role="alert" className="text-sm text-[var(--er)]">
          {error}
        </p>
      ) : null}
      <PieHoja alCancelar={alCerrar} cargando={loading} />
    </form>
  );
}

function HojaConfirmar({
  ejecutar,
  alCerrar,
  alListo,
  peligro = false,
}: {
  ejecutar: () => Promise<ResultadoAccion>;
  alCerrar: () => void;
  alListo: (aviso: string) => void;
  peligro?: boolean;
}) {
  const { run, loading, error } = useAsyncAction(async () => {
    const resultado = await ejecutar();
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          alListo(hecho.valor.valor);
        });
      }}
    >
      {error ? (
        <p role="alert" className="text-sm text-[var(--er)]">
          {error}
        </p>
      ) : null}
      <PieHoja peligro={peligro} alCancelar={alCerrar} cargando={loading} />
    </form>
  );
}
