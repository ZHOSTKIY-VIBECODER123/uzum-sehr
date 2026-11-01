import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export const STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_DEMO === "1";

export function supabaseBrowser(): SupabaseClient {
  client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // В сборке для Supabase этот флаг выключен, поэтому код демо не загружается и не выполняется.
    process.env.NEXT_PUBLIC_STATIC_DEMO === "1"
      ? { global: { fetch: async (input, init) => (await import("@/lib/demo/backend")).demoFetch(input, init) } }
      : undefined,
  );
  return client;
}

// Адрес страницы с учётом папки, в которой опубликован сайт (на GitHub Pages это /uzum-sehr).
export const withBase = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
