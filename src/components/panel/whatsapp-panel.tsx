"use client";

import { useState } from "react";

import { guardarWhatsappAccion, probarWhatsappAccion } from "@/app/administracion/actions";
import { PieHoja } from "@/components/administracion/pie-hoja";
import { Campo, claseCampo, useAvisoSalida } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { CampoContrasena } from "@/components/ui/campo-contrasena";
import { useAsyncAction } from "@/components/ui/use-async-action";
import type { VistaCredencial } from "@/lib/whatsapp/reglas";

type Sucursal = { id: string; nombre: string };

export function WhatsappPanel({
  tiendaId,
  sucursales,
  iniciales,
  alCancelar,
}: {
  tiendaId: string;
  sucursales: Sucursal[];
  iniciales: VistaCredencial[];
  alCancelar: () => void;
}) {
  const formId = `wa-${tiendaId}`;
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
    const resultado = await guardarWhatsappAccion(tiendaId, {
      sucursalId: ambito || null,
      phoneNumberId,
      wabaId,
      token: token || null,
      activo,
    });
    if (!resultado.ok) throw new Error(resultado.error);
    setCredenciales(resultado.credenciales);
    setToken("");
    sucio.limpiar();
    return resultado.aviso;
  });

  const probar = useAsyncAction(async () => {
    setPruebaOk(null);
    const resultado = await probarWhatsappAccion(tiendaId, ambito || null, telefono);
    if (!resultado.ok) throw new Error(resultado.error);
    setPruebaOk(resultado.aviso);
    return resultado.aviso;
  });

  return (
    <div className="flex flex-col gap-6">
      <form
        id={formId}
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!event.currentTarget.reportValidity()) return;
          void guardar.run();
        }}
        onChange={() => sucio.marcarSucio()}
      >
        <Campo id={`${formId}-ambito`} etiqueta="Dónde aplica">
          <select
            id={`${formId}-ambito`}
            name="ambito"
            value={ambito}
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
        <Campo id={`${formId}-phone`} etiqueta="Identificador del número" ayuda="El phone number ID de Meta. No es el celular.">
          <input
            id={`${formId}-phone`}
            name="phone-number-id"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            required
            value={phoneNumberId}
            onChange={(event) => setPhoneNumberId(event.target.value)}
            className={claseCampo}
          />
        </Campo>
        <Campo id={`${formId}-waba`} etiqueta="Identificador de la cuenta">
          <input
            id={`${formId}-waba`}
            name="waba-id"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            required
            value={wabaId}
            onChange={(event) => setWabaId(event.target.value)}
            className={claseCampo}
          />
        </Campo>
        <Campo
          id={`${formId}-token`}
          etiqueta="Token"
          ayuda={
            actual
              ? `Hay un token guardado que termina en ${actual.tokenUltimos}. Déjalo vacío para conservarlo.`
              : "Se guarda cifrado. No vuelve a mostrarse completo."
          }
        >
          <CampoContrasena
            id={`${formId}-token`}
            name="token"
            autoComplete="new-password"
            spellCheck={false}
            required={!actual}
            minLength={actual ? undefined : 20}
            maxLength={400}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            nombreSecreto="token"
            className={claseCampo}
          />
        </Campo>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="activo" checked={activo} onChange={(event) => setActivo(event.target.checked)} />
          Activo
        </label>
        {guardar.error ? (
          <p role="alert" className="text-sm text-[var(--er)]">
            {guardar.error}
          </p>
        ) : null}
      </form>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!event.currentTarget.reportValidity()) return;
          void probar.run();
        }}
      >
        <Campo id={`${formId}-prueba`} etiqueta="Celular de prueba" ayuda="Si la sucursal no tiene número propio, se usa el de la tienda.">
          <input
            id={`${formId}-prueba`}
            name="tel"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            value={telefono}
            onChange={(event) => setTelefono(event.target.value)}
            className={claseCampo}
          />
        </Campo>
        {pruebaOk ? (
          <p role="status" className="text-sm text-[var(--mu)]">
            {pruebaOk}
          </p>
        ) : null}
        {probar.error ? (
          <p role="alert" className="text-sm text-[var(--er)]">
            {probar.error}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="secundario"
          loading={probar.loading}
          loadingLabel="Enviando mensaje de prueba…"
          success={probar.success}
        >
          Enviar mensaje de prueba
        </Button>
      </form>
      <PieHoja form={formId} alCancelar={alCancelar} cargando={guardar.loading} />
    </div>
  );
}
