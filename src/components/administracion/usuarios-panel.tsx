"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  bloquearUsuarioAccion,
  borrarUsuarioAccion,
  cambiarContrasenaAccion,
  crearUsuarioAccion,
} from "@/app/administracion/actions";
import { Campo, claseCampo } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { etiquetaTipo, type UsuarioOrganizacion } from "@/lib/administracion/reglas";

type TiendaOpcion = { id: string; nombre: string };

export function UsuariosPanel({
  tiendas,
  usuarios,
}: {
  tiendas: TiendaOpcion[];
  usuarios: UsuarioOrganizacion[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <FormularioAlta tiendas={tiendas} />
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
    </div>
  );
}

function FormularioAlta({ tiendas }: { tiendas: TiendaOpcion[] }) {
  const router = useRouter();
  const publicar = useToast();
  const [tiendaId, setTiendaId] = useState(tiendas[0]?.id ?? "");
  const [tipo, setTipo] = useState("ventas");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const { run, loading, error, success } = useAsyncAction(async () => {
    const resultado = await crearUsuarioAccion({ tiendaId, tipo, correo, contrasena });
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.reportValidity()) return;
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          setCorreo("");
          setContrasena("");
          publicar("exito", hecho.valor.valor);
          router.refresh();
        });
      }}
    >
      <h2 className="text-lg font-semibold">Nuevo usuario</h2>
      {tiendas.length === 0 ? (
        <p className="text-sm leading-6">Primero tiene que haber una tienda.</p>
      ) : (
        <>
          <Campo id="usuario-tienda" etiqueta="Tienda">
            <select
              id="usuario-tienda"
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
          <Campo id="usuario-clave" etiqueta="Contraseña">
            <input
              id="usuario-clave"
              type="password"
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
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={loading} loadingLabel="Creando…" success={success} className="sm:w-fit">
            Crear usuario
          </Button>
        </>
      )}
    </form>
  );
}

function TarjetaUsuario({ usuario }: { usuario: UsuarioOrganizacion }) {
  const router = useRouter();
  const publicar = useToast();
  const [confirmar, setConfirmar] = useState<"bloquear" | "borrar" | null>(null);
  const [contrasena, setContrasena] = useState("");
  const bloqueo = useAsyncAction(async () => {
    const resultado = await bloquearUsuarioAccion(usuario.miembroId, usuario.activo);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });
  const borrado = useAsyncAction(async () => {
    const resultado = await borrarUsuarioAccion(usuario.miembroId);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });
  const clave = useAsyncAction(async () => {
    const resultado = await cambiarContrasenaAccion(usuario.miembroId, contrasena);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });
  const accion = confirmar === "borrar" ? borrado : bloqueo;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="min-w-0">
        <p className="break-words font-semibold">{usuario.correo ?? "Sin correo"}</p>
        <p className="text-sm text-[var(--mu)]">
          {usuario.tiendaNombre} · {etiquetaTipo(usuario.rol)} · {usuario.activo ? "Activo" : "Bloqueado"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secundario" size="sm" onClick={() => setConfirmar("bloquear")}>
          {usuario.activo ? "Bloquear" : "Desbloquear"}
        </Button>
        <Button type="button" variant="peligro" size="sm" onClick={() => setConfirmar("borrar")}>
          Borrar
        </Button>
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (!event.currentTarget.reportValidity()) return;
          void clave.run().then((hecho) => {
            if (hecho.omitida || !hecho.valor.ok) return;
            setContrasena("");
            publicar("exito", hecho.valor.valor);
            router.refresh();
          });
        }}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-medium" htmlFor={`clave-${usuario.miembroId}`}>
          Nueva contraseña
          <input
            id={`clave-${usuario.miembroId}`}
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            value={contrasena}
            onChange={(event) => setContrasena(event.target.value)}
            className={claseCampo}
          />
        </label>
        <Button type="submit" variant="secundario" loading={clave.loading} loadingLabel="Guardando…" success={clave.success}>
          Cambiar
        </Button>
      </form>
      {clave.error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {clave.error}
        </p>
      ) : null}
      <ConfirmDialog
        abierto={confirmar !== null}
        titulo={confirmar === "borrar" ? "Borrar usuario" : usuario.activo ? "Bloquear usuario" : "Desbloquear usuario"}
        descripcion={
          confirmar === "borrar"
            ? "Se borra la cuenta y pierde el acceso a la tienda. La tienda no se elimina."
            : usuario.activo
              ? "No podrá entrar. El inicio de sesión avisará que la cuenta está bloqueada."
              : "Vuelve a poder entrar con su contraseña."
        }
        etiquetaConfirmar={confirmar === "borrar" ? "Borrar" : usuario.activo ? "Bloquear" : "Desbloquear"}
        etiquetaCargando={confirmar === "borrar" ? "Borrando…" : "Guardando…"}
        peligro={confirmar === "borrar" || usuario.activo}
        cargando={accion.loading}
        error={accion.error}
        alCerrar={() => {
          if (!accion.loading) setConfirmar(null);
        }}
        alConfirmar={() => {
          void accion.run().then((hecho) => {
            if (hecho.omitida || !hecho.valor.ok) return;
            publicar("exito", hecho.valor.valor);
            setConfirmar(null);
            router.refresh();
          });
        }}
      />
    </Card>
  );
}
