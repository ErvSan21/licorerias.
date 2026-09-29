"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  bloquearUsuarioAccion,
  borrarUsuarioAccion,
  cambiarContrasenaAccion,
  crearUsuarioAccion,
} from "@/app/administracion/actions";
import { PieHoja } from "@/components/administracion/pie-hoja";
import { Campo, claseCampo } from "@/components/super/campo";
import { CampoContrasena } from "@/components/ui/campo-contrasena";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { etiquetaTipo, type UsuarioOrganizacion } from "@/lib/administracion/reglas";
import { capitalizar } from "@/lib/texto";
import { BotonAgregar } from "@/components/ui/boton-agregar";

type TiendaOpcion = { id: string; nombre: string };
type AccionUsuario = "bloquear" | "borrar" | "clave";

export function UsuariosPanel({
  tiendas,
  usuarios,
}: {
  tiendas: TiendaOpcion[];
  usuarios: UsuarioOrganizacion[];
}) {
  const [crear, setCrear] = useState(false);

  return (
    <main className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Usuarios</h2>
        <BotonAgregar etiqueta="Crear usuario" alTocar={() => setCrear(true)} />
      </div>
      {usuarios.length === 0 ? (
        <EmptyState titulo="Todavía no hay usuarios" descripcion="Crea un admin o un usuario de ventas en una tienda." />
      ) : (
        <ul className="flex flex-col gap-3">
          {usuarios.map((usuario) => (
            <li key={usuario.miembroId}>
              <TarjetaUsuario usuario={usuario} />
            </li>
          ))}
        </ul>
      )}
      <Drawer abierto={crear} titulo="Nuevo usuario" alCerrar={() => setCrear(false)}>
        <FormularioAlta
          tiendas={tiendas}
          alCerrar={() => setCrear(false)}
        />
      </Drawer>
    </main>
  );
}

function FormularioAlta({ tiendas, alCerrar }: { tiendas: TiendaOpcion[]; alCerrar: () => void }) {
  const router = useRouter();
  const publicar = useToast();
  const [tiendaId, setTiendaId] = useState(tiendas[0]?.id ?? "");
  const [tipo, setTipo] = useState("ventas");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [correo, setCorreo] = useState("");
  const [celular, setCelular] = useState("");
  const [contrasena, setContrasena] = useState("");
  const { run, loading, error } = useAsyncAction(async () => {
    const resultado = await crearUsuarioAccion({ tiendaId, tipo, nombre, apellido, correo, celular, contrasena });
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  if (tiendas.length === 0) {
    return (
      <>
        <p className="text-sm leading-6">Primero tiene que haber una tienda.</p>
        <PieHoja alCancelar={alCerrar} deshabilitado />
      </>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.reportValidity()) return;
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          setNombre("");
          setApellido("");
          setCorreo("");
          setCelular("");
          setContrasena("");
          publicar("exito", hecho.valor.valor);
          alCerrar();
          router.refresh();
        });
      }}
    >
      <Campo id="usuario-organizacion" etiqueta="Organización">
        <select
          id="usuario-organizacion"
          required
          value={tiendaId}
          onChange={(event) => setTiendaId(event.target.value)}
          className={claseCampo}
        >
          {tiendas.map((tienda) => (
            <option key={tienda.id} value={tienda.id}>
              {tienda.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo id="usuario-tipo" etiqueta="Tipo">
        <select id="usuario-tipo" required value={tipo} onChange={(event) => setTipo(event.target.value)} className={claseCampo}>
          <option value="admin">Admin</option>
          <option value="ventas">Ventas</option>
        </select>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="usuario-nombre" etiqueta="Nombre">
          <input
            id="usuario-nombre"
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
        <Campo id="usuario-apellido" etiqueta="Apellido">
          <input
            id="usuario-apellido"
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
      <Campo id="usuario-correo" etiqueta="Correo">
        <input
          id="usuario-correo"
          type="email"
          required
          autoComplete="off"
          spellCheck={false}
          value={correo}
          onChange={(event) => setCorreo(event.target.value)}
          className={claseCampo}
        />
      </Campo>
      <Campo id="usuario-celular" etiqueta="Celular (opcional)">
        <input
          id="usuario-celular"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="7XXXXXXX"
          value={celular}
          onChange={(event) => setCelular(event.target.value)}
          className={claseCampo}
        />
      </Campo>
      <Campo id="usuario-clave" etiqueta="Contraseña">
        <CampoContrasena
          id="usuario-clave"
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
      <PieHoja alCancelar={alCerrar} cargando={loading} etiquetaCargando="Creando…" />
    </form>
  );
}

function TarjetaUsuario({ usuario }: { usuario: UsuarioOrganizacion }) {
  const router = useRouter();
  const publicar = useToast();
  const [lista, setLista] = useState(false);
  const [accion, setAccion] = useState<AccionUsuario | null>(null);
  const nombre = usuario.nombre ?? usuario.correo ?? "Sin correo";

  function cerrar() {
    setLista(false);
    setAccion(null);
  }

  function abrir(siguiente: AccionUsuario) {
    setLista(false);
    setAccion(siguiente);
  }

  return (
    <Card className="flex items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="break-words font-semibold">{nombre}</p>
        {usuario.nombre && usuario.correo ? (
          <p className="break-all text-sm text-[var(--mu)]">{usuario.correo}</p>
        ) : null}
        <p className="text-sm text-[var(--mu)]">
          {usuario.tiendaNombre} · {etiquetaTipo(usuario.rol)} · {usuario.activo ? "Activo" : "Bloqueado"}
        </p>
      </div>
      <button
        type="button"
        className="boton-icono"
        aria-label={`Acciones de ${nombre}`}
        aria-haspopup="dialog"
        onClick={() => setLista(true)}
      >
        <span aria-hidden>⋮</span>
      </button>
      <Drawer abierto={lista} titulo={nombre} alCerrar={() => setLista(false)}>
        <ul className="flex flex-col">
          <li>
            <button type="button" className="menu-hoja-item" onClick={() => abrir("bloquear")}>
              {usuario.activo ? "Bloquear" : "Desbloquear"}
            </button>
          </li>
          <li>
            <button
              type="button"
              className="menu-hoja-item menu-hoja-item-peligro"
              onClick={() => abrir("borrar")}
            >
              Borrar
            </button>
          </li>
          <li>
            <button type="button" className="menu-hoja-item" onClick={() => abrir("clave")}>
              Cambiar contraseña
            </button>
          </li>
        </ul>
      </Drawer>
      <Drawer
        abierto={accion === "bloquear"}
        titulo={usuario.activo ? "Bloquear usuario" : "Desbloquear usuario"}
        descripcion={
          usuario.activo
            ? "No podrá entrar. El inicio de sesión avisará que la cuenta está bloqueada."
            : "Vuelve a poder entrar con su contraseña."
        }
        alCerrar={cerrar}
      >
        <HojaSimple
          ejecutar={() => bloquearUsuarioAccion(usuario.miembroId, usuario.activo)}
          alCerrar={cerrar}
          alListo={(aviso) => {
            publicar("exito", aviso);
            router.refresh();
          }}
        />
      </Drawer>
      <Drawer
        abierto={accion === "borrar"}
        titulo="Borrar usuario"
        descripcion="Se borra la cuenta y pierde el acceso a la tienda. La tienda no se elimina."
        alCerrar={cerrar}
      >
        <HojaSimple
          peligro
          ejecutar={() => borrarUsuarioAccion(usuario.miembroId)}
          alCerrar={cerrar}
          alListo={(aviso) => {
            publicar("exito", aviso);
            router.refresh();
          }}
        />
      </Drawer>
      <Drawer abierto={accion === "clave"} titulo="Cambiar contraseña" alCerrar={cerrar}>
        <FormularioClave
          miembroId={usuario.miembroId}
          alCerrar={cerrar}
          alListo={(aviso) => {
            publicar("exito", aviso);
            cerrar();
            router.refresh();
          }}
        />
      </Drawer>
    </Card>
  );
}

function FormularioClave({
  miembroId,
  alCerrar,
  alListo,
}: {
  miembroId: string;
  alCerrar: () => void;
  alListo: (aviso: string) => void;
}) {
  const [contrasena, setContrasena] = useState("");
  const { run, loading, error } = useAsyncAction(async () => {
    const resultado = await cambiarContrasenaAccion(miembroId, contrasena);
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
          setContrasena("");
          alListo(hecho.valor.valor);
        });
      }}
    >
      <Campo id={`clave-${miembroId}`} etiqueta="Nueva contraseña">
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
