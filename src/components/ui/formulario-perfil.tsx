"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { guardarPerfilAccion } from "@/app/perfil/actions";
import { Campo, claseCampo } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import type { Perfil } from "@/lib/perfil/reglas";
import { capitalizar } from "@/lib/texto";

/** Datos personales del usuario con sesión: nombre, apellido y celular. El correo es de solo lectura. */
export function FormularioPerfil({
  correo,
  perfil,
  alTerminar,
}: {
  correo: string;
  perfil: Perfil;
  /** Al guardar o cancelar: vuelve a la vista de datos. */
  alTerminar: () => void;
}) {
  const router = useRouter();
  const publicar = useToast();
  const [nombre, setNombre] = useState(perfil.nombre);
  const [apellido, setApellido] = useState(perfil.apellido);
  const [celular, setCelular] = useState(perfil.celular?.startsWith("591") ? perfil.celular.slice(3) : (perfil.celular ?? ""));
  const { run, loading, error } = useAsyncAction(async () => {
    const resultado = await guardarPerfilAccion({ nombre, apellido, celular });
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
          publicar("exito", hecho.valor.valor);
          alTerminar();
          router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Campo id="perfil-nombre" etiqueta="Nombre">
          <input
            id="perfil-nombre"
            required
            minLength={2}
            maxLength={60}
            autoComplete="given-name"
            autoCapitalize="words"
            value={nombre}
            onChange={(event) => setNombre(capitalizar(event.target.value))}
            className={claseCampo}
          />
        </Campo>
        <Campo id="perfil-apellido" etiqueta="Apellido">
          <input
            id="perfil-apellido"
            required
            minLength={2}
            maxLength={60}
            autoComplete="family-name"
            autoCapitalize="words"
            value={apellido}
            onChange={(event) => setApellido(capitalizar(event.target.value))}
            className={claseCampo}
          />
        </Campo>
      </div>
      <Campo id="perfil-correo" etiqueta="Correo">
        <input id="perfil-correo" type="email" readOnly value={correo} className={`${claseCampo} opacity-70`} />
      </Campo>
      <Campo id="perfil-celular" etiqueta="Celular">
        <input
          id="perfil-celular"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="7XXXXXXX"
          value={celular}
          onChange={(event) => setCelular(event.target.value)}
          className={claseCampo}
        />
      </Campo>
      {error ? (
        <p role="alert" className="text-sm text-[var(--er)]">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" loading={loading} loadingLabel="Guardando…">
          Guardar cambios
        </Button>
        <Button type="button" variant="secundario" className="flex-1" disabled={loading} onClick={alTerminar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
