"use client";

const MAX_LADO = 800;

export async function comprimirImagen(archivo: File): Promise<File> {
  if (!archivo.type.startsWith("image/")) {
    throw new Error("Elige una imagen.");
  }
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.max(1, Math.round(bitmap.width * escala));
  const alto = Math.max(1, Math.round(bitmap.height * escala));
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext("2d");
  if (!contexto) throw new Error("No se pudo preparar la imagen.");
  contexto.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    lienzo.toBlob(
      (resultado) => (resultado ? resolve(resultado) : reject(new Error("No se pudo comprimir la imagen."))),
      "image/jpeg",
      0.82,
    );
  });
  return new File([blob], "producto.jpg", { type: "image/jpeg" });
}
