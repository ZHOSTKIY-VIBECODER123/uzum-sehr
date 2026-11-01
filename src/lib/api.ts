import type { SupabaseClient } from "@supabase/supabase-js";

const ERRORS: Record<string, string> = {
  wish_unavailable: "Эту мечту только что выбрал кто-то другой. Посмотри другие огоньки!",
  wish_not_found: "Это желание больше недоступно.",
  booking_paused: "Бронирование временно приостановлено.",
  booking_limit: "Ты уже взял максимум желаний. Спасибо за доброту!",
  auth_required: "Сначала войди по почте.",
  forbidden: "Недостаточно прав для этого действия.",
  ward_id_taken: "Такой ID подопечного уже есть. ID должен быть уникальным.",
  validation_failed: "Проверь данные: заполнены не все поля или значения некорректны.",
  reason_required: "Укажи причину отмены бронирования.",
  booking_required: "Статус «Забронировано» появляется, только когда желание выбрал пользователь.",
  last_super_admin: "Нельзя снять последнего Super Admin.",
  media_not_found: "Файл не найден.",
};

export class ApiError extends Error {}

export function humanError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return ERRORS[message] ?? (message || "Что-то пошло не так. Попробуй ещё раз.");
}

export async function rpc<T>(client: SupabaseClient, fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new ApiError(error.message);
  return data as T;
}

const signedCache = new Map<string, { url: string; until: number }>();

// Фото детей лежат в закрытом хранилище и выдаются по короткоживущей ссылке.
export async function signedUrl(client: SupabaseClient, path: string): Promise<string | null> {
  const cached = signedCache.get(path);
  if (cached && cached.until > Date.now()) return cached.url;
  const { data } = await client.storage.from("wish-media").createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;
  signedCache.set(path, { url: data.signedUrl, until: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}
