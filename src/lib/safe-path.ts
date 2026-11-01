const BASE = "https://sehr.invalid";

// Адрес возврата после входа приходит из ссылки, поэтому пускаем только на страницы этого сайта.
export function safePath(next: string | null | undefined, fallback = "/my"): string {
  if (!next || !next.startsWith("/")) return fallback;
  try {
    const url = new URL(next, BASE);
    // Разбор URL превращает "/\evil.com" в чужой адрес, а "/.//evil.com" в путь "//evil.com".
    if (url.origin !== BASE || url.pathname.startsWith("//")) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
