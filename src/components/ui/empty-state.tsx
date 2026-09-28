export function EmptyState({
  titulo,
  descripcion,
}: {
  titulo: string;
  descripcion?: string;
}) {
  return (
    <div className="ui-vacio">
      <IconoVacio />
      <h3 className="text-base">{titulo}</h3>
      {descripcion ? <p className="text-sm leading-6 text-[var(--mu)]">{descripcion}</p> : null}
    </div>
  );
}

function IconoVacio() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" className="text-[var(--mu)]">
      <rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10h8M8 14h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
