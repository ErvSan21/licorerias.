export function EmptyState({
  titulo,
  descripcion,
}: {
  titulo: string;
  descripcion?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-zinc-300 px-4 py-8 dark:border-zinc-700">
      <IconoVacio />
      <h3 className="text-base font-semibold">{titulo}</h3>
      {descripcion ? <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{descripcion}</p> : null}
    </div>
  );
}

function IconoVacio() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" className="text-zinc-500">
      <rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10h8M8 14h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
