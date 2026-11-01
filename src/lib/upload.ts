import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_SIDE = 1400;

// Фото пересобирается в браузере: это убирает из файла геометку и другие метаданные.
export async function cleanImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Не удалось обработать фото"))), "image/jpeg", 0.88);
  });
}

// Случайное имя файла, чтобы в ссылке не было имени ребёнка.
export async function uploadWishFile(client: SupabaseClient, wishId: string, file: File): Promise<{ path: string; mime: string }> {
  const image = file.type.startsWith("image/");
  const body = image ? await cleanImage(file) : file;
  const mime = image ? "image/jpeg" : file.type;
  const extension = image ? "jpg" : (file.name.split(".").pop() ?? "bin").toLowerCase();
  const path = `${wishId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from("wish-media").upload(path, body, { contentType: mime, upsert: false });
  if (error) throw new Error(error.message);
  return { path, mime };
}
