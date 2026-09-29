"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormularioPerfil } from "@/components/ui/formulario-perfil";
import { formatoTelefono } from "@/lib/sucursales/reglas";
import { nombreVisible, type Perfil } from "@/lib/perfil/reglas";

/** Pantalla "Mi perfil": muestra los datos y, con Editar, el formulario. Igual en el panel y en Administración. */
export function PantallaPerfil({ correo, perfil, detalle }: { correo: string; perfil: Perfil; detalle: string }) {
  const [editando, setEditando] = useState(false);
  const nombre = nombreVisible(perfil, null);
  const completo = nombre !== "Sin nombre";
  const iniciales =
    `${perfil.nombre.charAt(0)}${perfil.apellido.charAt(0)}`.toUpperCase() || correo.charAt(0).toUpperCase() || "?";

  return (
    <main className="flex flex-col gap-4">
      <h2 className="text-pretty text-lg font-semibold">Mi perfil</h2>
      <section className="dashboard-tarjeta flex items-center gap-4">
        <span aria-hidden="true" className="perfil-avatar">
          {iniciales}
        </span>
        <div className="min-w-0">
          <p className="break-words font-semibold">{completo ? nombre : "Completa tu nombre"}</p>
          <p className="text-sm text-[var(--mu)]">{detalle}</p>
        </div>
      </section>

      <section className="dashboard-tarjeta">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="!mb-0">Datos personales</h3>
          {editando ? null : (
            <Button type="button" size="sm" variant="secundario" onClick={() => setEditando(true)}>
              Editar
            </Button>
          )}
        </div>
        {editando ? (
          <FormularioPerfil correo={correo} perfil={perfil} alTerminar={() => setEditando(false)} />
        ) : (
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Dato titulo="Nombre" valor={perfil.nombre} />
            <Dato titulo="Apellido" valor={perfil.apellido} />
            <Dato titulo="Correo" valor={correo} />
            <Dato titulo="Celular" valor={perfil.celular ? formatoTelefono(perfil.celular) : ""} />
          </dl>
        )}
      </section>
    </main>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--mu)]">{titulo}</dt>
      <dd className={`break-words ${valor ? "" : "text-[var(--mu)]"}`}>{valor || "Sin completar"}</dd>
    </div>
  );
}
