"use client";

import { useState } from "react";

import { Campo, claseCampo, useAvisoSalida } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { useAsyncAction } from "@/components/ui/use-async-action";
import type { VistaCredencial } from "@/lib/whatsapp/reglas";

type Sucursal = { id: string; nombre: string };

export function WhatsappPanel({
  slug,
  lectura,
  sucursales,
  iniciales,
}: {
  slug: string;
  lectura: boolean;
  sucursales: Sucursal[];
  iniciales: VistaCredencial[];
}) {
  const [credenciales, setCredenciales] = useState(iniciales);
  const [ambito, setAmbito] = useState("");
  const actual = credenciales.find((fila) => (fila.sucursalId ?? "") === ambito) ?? null;
  const [phoneNumberId, setPhoneNumberId] = useState(actual?.phoneNumberId ?? "");
  const [wabaId, setWabaId] = useState(actual?.wabaId ?? "");
  const [token, setToken] = useState("");
  const [activo, setActivo] = useState(actual?.activo ?? true);
  const [telefono, setTelefono] = useState("");
  const [pruebaOk, setPruebaOk] = useState<string | null>(null);
  const sucio = useAvisoSalida();

  function elegir(siguiente: string) {
    const fila = credenciales.find((item) => (item.sucursalId ?? "") === siguiente) ?? null;
    setAmbito(siguiente);
    setPhoneNumberId(fila?.phoneNumberId ?? "");
    setWabaId(fila?.wabaId ?? "");
    setToken("");
    setActivo(fila?.activo ?? true);
    setPruebaOk(null);
  }

  const guardar = useAsyncAction(async () => {
    setPruebaOk(null);
    const respuesta = await fetch(`/api/t/${slug}/whatsapp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sucursalId: ambito || null,
        phoneNumberId,
        wabaId,
        token: token || null,
        activo,
      }),
    });
    const cuerpo = (await respuesta.json().catch(() => null)) as { error?: string; credenciales?: VistaCredencial[] } | null;
    if (!respuesta.ok || !cuerpo?.credenciales) {
      throw new Error(cuerpo?.error || "No se pudo guardar. Revisa los datos e inténtalo de nuevo.");
    }
    setCredenciales(cuerpo.credenciales);
    setToken("");
    sucio.limpiar();
  });

  const probar = useAsyncAction(async () => {
    setPruebaOk(null);
    const respuesta = await fetch(`/api/t/${slug}/whatsapp/prueba`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sucursalId: ambito || null, telefono }),
    });
    const cuerpo = (await respuesta.json().catch(() => null)) as { error?: string } | null;
    if (!respuesta.ok) {
      throw new Error(cuerpo?.error || "No se pudo enviar. Revisa el número e inténtalo de nuevo.");
    }
    setPruebaOk("Mensaje de prueba enviado.");
  });

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex max-w-lg flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void guardar.run();
        }}
        onChange={() => sucio.marcarSucio()}
      >
        <Campo id="wa-ambito" etiqueta="Dónde aplica">
          <select
            id="wa-ambito"
            name="ambito"
            value={ambito}
            disabled={lectura}
            onChange={(event) => elegir(event.target.value)}
            className={claseCampo}
          >
            <option value="">Toda la tienda</option>
            {sucursales.map((sucursal) => (
              <option key={sucursal.id} value={sucursal.id}>
                {sucursal.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="wa-phone" etiqueta="Identificador del número" ayuda="El phone number ID de Meta. No es el celular.">
          <input
            id="wa-phone"
            name="phone-number-id"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            required
            disabled={lectura}
            value={phoneNumberId}
            onChange={(event) => setPhoneNumberId(event.target.value)}
            className={claseCampo}
          />
        </Campo>
        <Campo id="wa-waba" etiqueta="Identificador de la cuenta">
          <input
            id="wa-waba"
            name="waba-id"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            required
            disabled={lectura}
            value={wabaId}
            onChange={(event) => setWabaId(event.target.value)}
            className={claseCampo}
          />
        </Campo>
        <Campo
          id="wa-token"
          etiqueta="Token"
          ayuda={actual ? `Hay un token guardado que termina en ${actual.tokenUltimos}. Déjalo vacío para conservarlo.` : "Se guarda cifrado. No vuelve a mostrarse completo."}
        >
          <input
            id="wa-token"
            name="token"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            required={!actual}
            minLength={actual ? undefined : 20}
            maxLength={400}
            disabled={lectura}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className={claseCampo}
          />
        </Campo>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="activo"
            checked={activo}
            disabled={lectura}
            onChange={(event) => setActivo(event.target.checked)}
          />
          Activo
        </label>
        <Button type="submit" loading={guardar.loading} loadingLabel="Guardando…" success={guardar.success} error={guardar.error ?? false} disabled={lectura}>
          Guardar credenciales
        </Button>
      </form>
      <form
        className="flex max-w-lg flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void probar.run();
        }}
      >
        <Campo id="wa-prueba" etiqueta="Celular de prueba" ayuda="Si la sucursal no tiene número propio, se usa el de la tienda.">
          <input
            id="wa-prueba"
            name="tel"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            disabled={lectura}
            value={telefono}
            onChange={(event) => setTelefono(event.target.value)}
            className={claseCampo}
          />
        </Campo>
        {pruebaOk ? (
          <p role="status" className="text-sm text-zinc-700 dark:text-zinc-300">
            {pruebaOk}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="secundario"
          loading={probar.loading}
          loadingLabel="Enviando mensaje de prueba…"
          success={probar.success}
          error={probar.error ?? false}
          disabled={lectura}
        >
          Enviar mensaje de prueba
        </Button>
      </form>
    </div>
  );
}
