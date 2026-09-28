"use client";

const CLAVE = "licorerias-tema";

export function BotonTema() {
  function alternar() {
    const raiz = document.documentElement;
    const sistemaOscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const ahoraOscuro = raiz.dataset.theme === "dark" || (raiz.dataset.theme !== "light" && sistemaOscuro);
    const siguiente = ahoraOscuro ? "light" : "dark";
    raiz.dataset.theme = siguiente;
    try {
      localStorage.setItem(CLAVE, siguiente);
    } catch {
      // El tema sigue aplicado en esta visita.
    }
  }

  return (
    <button type="button" className="panel-tema" onClick={alternar} aria-label="Cambiar tema claro u oscuro">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3v2.2M12 18.8V21M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3 12h2.2M18.8 12H21M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" strokeLinecap="round" />
        <circle cx="12" cy="12" r="3.2" />
      </svg>
    </button>
  );
}
