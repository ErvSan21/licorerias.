import Link from "next/link";

export function TiendaNoDisponible({ slug }: { slug: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Tienda no disponible</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--mu)]">
        Esta tienda no está disponible en este momento.
      </p>
      <Link
        href={`/login?siguiente=${encodeURIComponent(`/t/${slug}/panel`)}`}
        className="mt-6 inline-flex min-h-11 touch-manipulation items-center text-sm font-medium underline-offset-4 hover:underline"
      >
        Entrar como personal
      </Link>
    </main>
  );
}
