import Link from "next/link";

export default function TiendaNoEncontrada() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <h1 className="text-xl font-semibold">No encontrado</h1>
      <p className="mt-3 text-sm leading-6">
        Esa tienda no existe o no tienes acceso.
      </p>
      <Link href="/login" className="mt-6 text-sm font-medium underline">
        Volver a entrar
      </Link>
    </main>
  );
}