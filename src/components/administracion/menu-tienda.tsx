"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  crearSucursalAdminAccion,
  eliminarTiendaAccion,
  guardarPlazoAccion,
  inactivarTiendaAccion,
  leerWhatsappAccion,
} from "@/app/administracion/actions";
import { PieHoja } from "@/components/administracion/pie-hoja";
import { WhatsappPanel } from "@/components/panel/whatsapp-panel";
import { Campo, claseCampo } from "@/components/super/campo";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { etiquetaPlazo, hoyBolivia, PLAZOS, type Plazo } from "@/lib/licencias/reglas";
import { capitalizar } from "@/lib/texto";
import type { VistaCredencial } from "@/lib/whatsapp/reglas";

export type TiendaMenu = {
  id: string;
  nombre: string;
  estado: string;
  inicio: string | null;
  vence: string | null;
  plazo: Plazo | null;
  /** Si la tienda puede tener varias sucursales: habilita "Agregar sucursal". */
  sucursalesHabilitadas: boolean;
};

type Accion = "inactivar" | "eliminar" | "whatsapp" | "planes" | "sucursal";

export function MenuTienda({ tienda }: { tienda: TiendaMenu }) {
  const router = useRouter();
  const publicar = useToast();
  const [lista, setLista] = useState(false);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [whatsapp, setWhatsapp] = useState<{
    sucursales: { id: string; nombre: string }[];
    credenciales: VistaCredencial[];
  } | null>(null);
  const [errorWhatsapp, setErrorWhatsapp] = useState<string | null>(null);

  function cerrar() {
    setLista(false);
    setAccion(null);
  }

  function abrir(siguiente: Accion) {
    setLista(false);
    setAccion(siguiente);
    if (siguiente !== "whatsapp") return;
    setWhatsapp(null);
    setErrorWhatsapp(null);
    void leerWhatsappAccion(tienda.id).then((resultado) => {
      if (!resultado.ok) {
        setErrorWhatsapp(resultado.error);
        return;
      }
      setWhatsapp(resultado.valor);
    });
  }

  return (
    <>
      <button
        type="button"
        className="boton-icono"
        aria-label={`Acciones de ${tienda.nombre}`}
        aria-haspopup="dialog"
        onClick={() => setLista(true)}
      >
        <span aria-hidden>⋮</span>
      </button>
      <Drawer abierto={lista} titulo={tienda.nombre} alCerrar={() => setLista(false)}>
        <ul className="flex flex-col">
          {tienda.sucursalesHabilitadas ? <Item onClick={() => abrir("sucursal")}>Agregar sucursal</Item> : null}
          <Item onClick={() => abrir("inactivar")}>Inactivar</Item>
          <Item peligro onClick={() => abrir("eliminar")}>
            Eliminar
          </Item>
          <Item onClick={() => abrir("whatsapp")}>Configurar WhatsApp</Item>
          <Item onClick={() => abrir("planes")}>Planes</Item>
        </ul>
      </Drawer>
      <Drawer abierto={accion === "sucursal"} titulo="Agregar sucursal" descripcion={tienda.nombre} alCerrar={cerrar}>
        {accion === "sucursal" ? (
          <FormularioSucursal
            tiendaId={tienda.id}
            alCerrar={cerrar}
            alListo={(aviso) => {
              publicar("exito", aviso);
              cerrar();
              router.refresh();
            }}
          />
        ) : null}
      </Drawer>
      <Drawer
        abierto={accion === "inactivar"}
        titulo={`Inactivar ${tienda.nombre}`}
        descripcion="La tienda y sus sucursales quedan suspendidas. La tienda pública muestra “Tienda no disponible” y el panel queda en solo lectura."
        alCerrar={cerrar}
      >
        <HojaSimple
          ejecutar={() => inactivarTiendaAccion(tienda.id)}
          alCerrar={cerrar}
          alListo={(aviso) => {
            publicar("exito", aviso);
            router.refresh();
          }}
        />
      </Drawer>
      <Drawer
        abierto={accion === "eliminar"}
        titulo={`Eliminar ${tienda.nombre}`}
        descripcion="Se borra la tienda, sus sucursales y sus datos. Esta acción no se deshace."
        alCerrar={cerrar}
      >
        <HojaSimple
          peligro
          ejecutar={() => eliminarTiendaAccion(tienda.id)}
          alCerrar={cerrar}
          alListo={(aviso) => {
            publicar("exito", aviso);
            router.refresh();
          }}
        />
      </Drawer>
      <Drawer abierto={accion === "whatsapp"} titulo="Configurar WhatsApp" alCerrar={cerrar}>
        {errorWhatsapp ? (
          <p role="alert" className="text-sm text-[var(--er)]">
            {errorWhatsapp}
          </p>
        ) : null}
        {whatsapp ? (
          <WhatsappPanel
            tiendaId={tienda.id}
            sucursales={whatsapp.sucursales}
            iniciales={whatsapp.credenciales}
            alCancelar={cerrar}
          />
        ) : errorWhatsapp ? (
          <PieHoja alCancelar={cerrar} deshabilitado />
        ) : (
          <p className="text-sm text-[var(--mu)]">Cargando WhatsApp…</p>
        )}
      </Drawer>
      <Drawer
        abierto={accion === "planes"}
        titulo="Planes"
        descripcion="Puedes alargar la fecha antes de que venza. Demo no tiene fecha de fin."
        alCerrar={cerrar}
      >
        {tienda.plazo ? (
          <FormularioPlan
            tiendaId={tienda.id}
            plazoActual={tienda.plazo}
            venceActual={tienda.vence}
            alCerrar={cerrar}
            alListo={(aviso) => {
              publicar("exito", aviso);
              cerrar();
              router.refresh();
            }}
          />
        ) : (
          <>
            <p className="text-sm">Esta tienda no tiene licencia.</p>
            <PieHoja alCancelar={cerrar} deshabilitado />
          </>
        )}
      </Drawer>
    </>
  );
}

function FormularioSucursal({
  tiendaId,
  alCerrar,
  alListo,
}: {
  tiendaId: string;
  alCerrar: () => void;
  alListo: (aviso: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const { run, loading, error } = useAsyncAction(async () => {
    const resultado = await crearSucursalAdminAccion({ tiendaId, nombre, direccion });
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
      <Campo id={`sucursal-nombre-${tiendaId}`} etiqueta="Nombre">
        <input
          id={`sucursal-nombre-${tiendaId}`}
          required
          minLength={2}
          maxLength={80}
          autoComplete="off"
          value={nombre}
          onChange={(event) => setNombre(capitalizar(event.target.value))}
          className={claseCampo}
        />
      </Campo>
      <Campo id={`sucursal-direccion-${tiendaId}`} etiqueta="Dirección">
        <input
          id={`sucursal-direccion-${tiendaId}`}
          required
          minLength={4}
          maxLength={160}
          autoComplete="off"
          value={direccion}
          onChange={(event) => setDireccion(capitalizar(event.target.value))}
          className={claseCampo}
        />
      </Campo>
      <p className="text-xs text-[var(--mu)]">
        Abre todos los días, todo el día. El dueño ajusta horario, mapa y delivery desde su panel.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-[var(--er)]">
          {error}
        </p>
      ) : null}
      <PieHoja alCancelar={alCerrar} cargando={loading} etiquetaCargando="Creando…" />
    </form>
  );
}

function FormularioPlan({
  tiendaId,
  plazoActual,
  venceActual,
  alCerrar,
  alListo,
}: {
  tiendaId: string;
  plazoActual: Plazo;
  venceActual: string | null;
  alCerrar: () => void;
  alListo: (aviso: string) => void;
}) {
  const hoy = hoyBolivia();
  const minimo = venceActual && venceActual > hoy ? venceActual : hoy;
  const [plazo, setPlazo] = useState<Plazo>(plazoActual);
  const [vence, setVence] = useState(venceActual && venceActual >= minimo ? venceActual : minimo);
  const { run, loading, error } = useAsyncAction(async () => {
    const resultado = await guardarPlazoAccion({
      tiendaId,
      plazo,
      vence: plazo === "demo" ? null : vence,
    });
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
      <Campo id={`plazo-${tiendaId}`} etiqueta="Plan">
        <select
          id={`plazo-${tiendaId}`}
          required
          value={plazo}
          onChange={(event) => setPlazo(event.target.value as Plazo)}
          className={claseCampo}
        >
          {PLAZOS.map((opcion) => (
            <option key={opcion} value={opcion}>
              {etiquetaPlazo(opcion)}
            </option>
          ))}
        </select>
      </Campo>
      {plazo === "demo" ? null : (
        <Campo id={`vence-${tiendaId}`} etiqueta="Fin">
          <input
            id={`vence-${tiendaId}`}
            type="date"
            required
            min={minimo}
            value={vence}
            onChange={(event) => setVence(event.target.value)}
            className={`${claseCampo} tabular-nums`}
          />
        </Campo>
      )}
      {error ? (
        <p role="alert" className="text-sm text-[var(--er)]">
          {error}
        </p>
      ) : null}
      <PieHoja alCancelar={alCerrar} cargando={loading} />
    </form>
  );
}

function HojaSimple({
  ejecutar,
  alCerrar,
  alListo,
  peligro = false,
}: {
  ejecutar: () => Promise<{ ok: true; aviso: string } | { ok: false; error: string }>;
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
          alCerrar();
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

function Item({
  children,
  onClick,
  peligro = false,
}: {
  children: string;
  onClick: () => void;
  peligro?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        className={`menu-hoja-item ${peligro ? "menu-hoja-item-peligro" : ""}`}
        onClick={onClick}
      >
        {children}
      </button>
    </li>
  );
}
