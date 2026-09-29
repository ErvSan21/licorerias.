import { EsqueletoLista } from "@/components/panel/esqueletos";

export default function CargandoUsuarios() {
  return <EsqueletoLista etiqueta="Cargando usuarios…" accion filas={5} redonda />;
}
